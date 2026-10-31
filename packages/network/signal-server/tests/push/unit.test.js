import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";

import {
    MAX_PUSH_BYTES,
    RateLimiter,
    clientAddress,
    encryptPush,
    generateVapidKeys,
    isPublicEndpoint,
    openSubscription,
    parseSubscription,
    sealSubscription,
    sendPush,
    validateVapidKeys,
    vapidAuthorization,
} from "@papit/signal-server";

// ############ HELPERS #####################

const SUBJECT = "mailto:test@example.com";

const decode = (text) => Buffer.from(text, "base64url");

/** A browser's side of a subscription: its keys, and the decryption RFC 8291 describes. */
function browser(endpoint = "https://push.example.com/abc") {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const auth = randomBytes(16);
    return {
        ecdh,
        subscription: {
            endpoint,
            keys: { p256dh: ecdh.getPublicKey("base64url"), auth: auth.toString("base64url") },
        },
        decrypt: (message) => decrypt(message, ecdh, auth),
    };
}

function decrypt(message, ecdh, auth) {
    const salt = message.subarray(0, 16);
    const idlength = message[20];
    const sender = message.subarray(21, 21 + idlength);
    const record = message.subarray(21 + idlength);

    const info = Buffer.concat([Buffer.from("WebPush: info\0"), ecdh.getPublicKey(), sender]);
    const ikm = Buffer.from(hkdfSync("sha256", ecdh.computeSecret(sender), auth, info, 32));
    const key = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
    const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

    const decipher = createDecipheriv("aes-128-gcm", key, nonce);
    decipher.setAuthTag(record.subarray(-16));
    const plain = Buffer.concat([decipher.update(record.subarray(0, -16)), decipher.final()]);
    assert.strictEqual(plain.at(-1), 2);
    return plain.subarray(0, -1).toString();
}

function parseAuthorization(header) {
    const [, token, key] = /^vapid t=(.+), k=(.+)$/.exec(header);
    const [head, claims, signature] = token.split(".");
    return { token, key, head, claims: JSON.parse(decode(claims)), signature };
}

function verifies(token, publicKey) {
    const [head, claims, signature] = token.split(".");
    const point = decode(publicKey);
    const key = createPublicKey({
        format: "jwk",
        key: {
            kty: "EC",
            crv: "P-256",
            x: point.subarray(1, 33).toString("base64url"),
            y: point.subarray(33).toString("base64url"),
        },
    });
    return verify("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" }, decode(signature));
}

// ############ TESTS #####################

describe("vapid", () => {

    it("generates a valid pair", () => {
        const keys = generateVapidKeys();
        assert.strictEqual(decode(keys.publicKey).length, 65);
        assert.strictEqual(decode(keys.privateKey).length, 32);
        assert.doesNotThrow(() => validateVapidKeys(keys));
    });

    it("rejects malformed and mismatched keys", () => {
        const keys = generateVapidKeys();
        assert.throws(() => validateVapidKeys({ ...keys, publicKey: "abc" }), /public key/);
        assert.throws(() => validateVapidKeys({ ...keys, privateKey: "abc" }), /private key/);
        assert.throws(() => validateVapidKeys({ ...keys, publicKey: generateVapidKeys().publicKey }), /not a pair/);
    });

    it("signs a token for the endpoint's origin", () => {
        const keys = generateVapidKeys();
        const header = vapidAuthorization("https://push.example.com/send/abc?x=1", keys, SUBJECT, 1000);
        const { token, key, claims } = parseAuthorization(header);

        assert.strictEqual(key, keys.publicKey);
        assert.deepStrictEqual(claims, { aud: "https://push.example.com", exp: 1000 + 12 * 60 * 60, sub: SUBJECT });
        assert.ok(verifies(token, keys.publicKey));
        assert.ok(!verifies(token, generateVapidKeys().publicKey));
    });
});

describe("encrypt", () => {

    // RFC 8291 appendix A
    it("matches the RFC 8291 example", () => {
        const message = encryptPush("When I grow up, I want to be a watermelon", {
            endpoint: "https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV",
            keys: {
                p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
                auth: "BTBZMqHH6r4Tts7J_aSIgg",
            },
        }, {
            privateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            salt: "DGv6ra1nlYgDCS1FRnbzlw",
        });

        assert.strictEqual(
            message.toString("base64url"),
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
        );
    });

    it("gives a different message each time, both readable by the browser", () => {
        const { subscription, decrypt } = browser();
        const a = encryptPush("hello", subscription);
        const b = encryptPush("hello", subscription);

        assert.notDeepStrictEqual(a, b);
        assert.strictEqual(decrypt(a), "hello");
        assert.strictEqual(decrypt(b), "hello");
    });

    it("carries the largest payload and refuses one more byte", () => {
        const { subscription, decrypt } = browser();
        const largest = "x".repeat(MAX_PUSH_BYTES);

        const message = encryptPush(largest, subscription);
        assert.strictEqual(message.length, 4096);
        assert.strictEqual(decrypt(message), largest);
        assert.throws(() => encryptPush(largest + "x", subscription), RangeError);
    });

    it("rejects malformed subscription keys", () => {
        const { subscription } = browser();
        assert.throws(() => encryptPush("x", { ...subscription, keys: { ...subscription.keys, p256dh: "abc" } }), /p256dh/);
        assert.throws(() => encryptPush("x", { ...subscription, keys: { ...subscription.keys, auth: "abc" } }), /auth/);
    });
});

describe("token", () => {

    it("opens what it sealed, keeping only the fields a push needs", () => {
        const keys = generateVapidKeys();
        const { subscription } = browser();

        const token = sealSubscription({ ...subscription, expirationTime: null }, keys);
        assert.deepStrictEqual(openSubscription(token, keys), subscription);
    });

    it("hides the subscription and differs each time", () => {
        const keys = generateVapidKeys();
        const { subscription } = browser();

        const token = sealSubscription(subscription, keys);
        assert.notStrictEqual(token, sealSubscription(subscription, keys));
        assert.ok(!decode(token).toString().includes("push.example.com"));
    });

    it("refuses a token that was changed", () => {
        const keys = generateVapidKeys();
        const bytes = decode(sealSubscription(browser().subscription, keys));

        for (const index of [0, 20, bytes.length - 1])
        {
            const changed = Buffer.from(bytes);
            changed[index] ^= 1;
            assert.strictEqual(openSubscription(changed.toString("base64url"), keys), null);
        }
    });

    it("refuses a token sealed with other keys", () => {
        const token = sealSubscription(browser().subscription, generateVapidKeys());
        assert.strictEqual(openSubscription(token, generateVapidKeys()), null);
    });

    it("returns null on garbage instead of throwing", () => {
        const keys = generateVapidKeys();
        for (const token of ["", "abc", "x".repeat(500), 42, null, undefined, {}])
        {
            assert.strictEqual(openSubscription(token, keys), null);
        }
    });
});

describe("validate", () => {
    const endpoint = "https://push.example.com/abc";
    const resolvesTo = (...addresses) => async () => addresses.map(address => ({ address }));

    it("accepts a subscription on any https host, keeping only the fields a push needs", () => {
        const { subscription } = browser("https://push.selfhosted.dev:8443/abc");
        assert.deepStrictEqual(parseSubscription({ ...subscription, expirationTime: null }), subscription);
    });

    it("refuses endpoints the server must not call", () => {
        for (const url of [
            "http://push.example.com/abc",
            "ftp://push.example.com/abc",
            "https://localhost/abc",
            "https://intranet/abc",
            "https://127.0.0.1/abc",
            "https://2130706433/abc",
            "https://[::1]/abc",
            "https://user:secret@push.example.com/abc",
            `https://push.example.com/${"x".repeat(2048)}`,
            "not a url",
        ])
        {
            assert.strictEqual(parseSubscription(browser(url).subscription), null, url);
        }
    });

    it("lets local endpoints through with allowPrivate, still only http and https", () => {
        for (const url of ["http://localhost:3000/abc", "https://127.0.0.1/abc", "http://intranet/abc", "http://[::1]/abc"])
        {
            const { subscription } = browser(url);
            assert.deepStrictEqual(parseSubscription(subscription, true), subscription, url);
        }

        assert.strictEqual(parseSubscription(browser("ftp://localhost/abc").subscription, true), null);
        assert.strictEqual(parseSubscription(browser("http://user:secret@localhost/abc").subscription, true), null);
    });

    it("refuses malformed input", () => {
        const { subscription } = browser();
        const { p256dh, auth } = subscription.keys;

        for (const value of [
            undefined,
            null,
            "text",
            42,
            [],
            {},
            { endpoint },
            { endpoint: 42, keys: subscription.keys },
            { endpoint, keys: { p256dh } },
            { endpoint, keys: { p256dh: 42, auth } },
            { endpoint, keys: { p256dh: "abc", auth } },
            { endpoint, keys: { p256dh, auth: "abc" } },
            // right length, not a point on the curve
            { endpoint, keys: { p256dh: Buffer.alloc(65, 4).toString("base64url"), auth } },
        ])
        {
            assert.strictEqual(parseSubscription(value), null);
        }
    });

    it("accepts public addresses", async () => {
        assert.ok(await isPublicEndpoint(endpoint, resolvesTo("142.250.74.106")));
        assert.ok(await isPublicEndpoint(endpoint, resolvesTo("2a00:1450:4001:82f::200a")));
    });

    it("refuses private addresses", async () => {
        for (const address of [
            "0.0.0.0",
            "10.1.2.3",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.169.254",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "198.18.0.1",
            "224.0.0.1",
            "255.255.255.255",
            "::",
            "::1",
            "fc00::1",
            "fd12::1",
            "fe80::1",
            "ff02::1",
            "::ffff:127.0.0.1",
            "::ffff:10.0.0.1",
        ])
        {
            assert.strictEqual(await isPublicEndpoint(endpoint, resolvesTo(address)), false, address);
        }
    });

    it("refuses a host with one private address among public ones", async () => {
        assert.strictEqual(await isPublicEndpoint(endpoint, resolvesTo("142.250.74.106", "10.0.0.1")), false);
    });

    it("refuses a host that does not resolve", async () => {
        assert.strictEqual(await isPublicEndpoint(endpoint, resolvesTo()), false);
        assert.strictEqual(await isPublicEndpoint(endpoint, async () => { throw new Error("ENOTFOUND"); }), false);
        assert.strictEqual(await isPublicEndpoint("not a url", resolvesTo("142.250.74.106")), false);
    });
});

describe("limit", () => {
    const limiters = [];
    const limiter = (rate) => {
        const created = new RateLimiter(rate);
        limiters.push(created);
        return created;
    };

    afterEach(() => {
        for (const created of limiters.splice(0)) created.close();
    });

    it("allows a burst up to the rate, then refills over a minute", () => {
        const limit = limiter(2);

        assert.ok(limit.allow("a", 0));
        assert.ok(limit.allow("a", 0));
        assert.ok(!limit.allow("a", 0));
        assert.ok(!limit.allow("a", 29_000));
        assert.ok(limit.allow("a", 31_000));
        assert.ok(!limit.allow("a", 31_000));
    });

    it("keeps keys apart", () => {
        const limit = limiter(1);

        assert.ok(limit.allow("a", 0));
        assert.ok(limit.allow("b", 0));
        assert.ok(!limit.allow("a", 0));
    });

    it("never limits at rate 0", () => {
        const limit = limiter(0);
        for (let i = 0; i < 100; i++) assert.ok(limit.allow("a", 0));
        assert.strictEqual(limit.size, 0);
    });

    it("forgets idle keys, keeps recent ones", () => {
        const limit = limiter(5);
        limit.allow("old", 0);
        limit.allow("new", 50_000);

        limit.sweep(60_000);
        assert.strictEqual(limit.size, 1);

        limit.sweep(110_000);
        assert.strictEqual(limit.size, 0);
    });

    it("picks the address a trusted proxy saw", () => {
        const request = (forwarded) => ({
            headers: forwarded ? { "x-forwarded-for": forwarded } : {},
            socket: { remoteAddress: "10.0.0.9" },
        });

        assert.strictEqual(clientAddress(request("1.1.1.1")), "10.0.0.9");
        assert.strictEqual(clientAddress(request("9.9.9.9, 1.1.1.1"), 1), "1.1.1.1");
        assert.strictEqual(clientAddress(request("9.9.9.9, 1.1.1.1, 2.2.2.2"), 2), "1.1.1.1");
        assert.strictEqual(clientAddress(request(), 1), "10.0.0.9");
        assert.strictEqual(clientAddress(request("1.1.1.1"), 3), "10.0.0.9");
    });
});

describe("send", { timeout: 5000 }, () => {
    let server;

    /** A local push service answering `status`. Calls land in `requests`. */
    async function pushService(status, respond = true) {
        const requests = [];
        server = http.createServer(async (request, response) => {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            requests.push({ headers: request.headers, body: Buffer.concat(chunks) });
            if (!respond) return;
            response.writeHead(status, status === 302 ? { location: "http://localhost:1/" } : {});
            response.end();
        });
        server.listen(0);
        await once(server, "listening");
        return { requests, endpoint: `http://localhost:${server.address().port}/push/abc` };
    }

    afterEach(() => {
        server?.closeAllConnections();
        server?.close();
        server = undefined;
    });

    it("posts an encrypted, signed push", async () => {
        const { requests, endpoint } = await pushService(201);
        const { subscription, decrypt } = browser(endpoint);
        const keys = generateVapidKeys();

        const status = await sendPush(subscription, "ring", keys, SUBJECT, { ttl: 30, urgency: "normal" });

        assert.strictEqual(status, "sent");
        const [{ headers, body }] = requests;
        assert.strictEqual(headers["content-encoding"], "aes128gcm");
        assert.strictEqual(headers.ttl, "30");
        assert.strictEqual(headers.urgency, "normal");
        assert.ok(verifies(parseAuthorization(headers.authorization).token, keys.publicKey));
        assert.strictEqual(decrypt(body), "ring");
    });

    it("reports a dead subscription as gone", async () => {
        for (const code of [404, 410])
        {
            const { endpoint } = await pushService(code);
            const status = await sendPush(browser(endpoint).subscription, "x", generateVapidKeys(), SUBJECT);
            assert.strictEqual(status, "gone");
            server.close();
        }
    });

    it("reports other answers as failed and does not follow redirects", async () => {
        for (const code of [429, 500, 302])
        {
            const { requests, endpoint } = await pushService(code);
            const status = await sendPush(browser(endpoint).subscription, "x", generateVapidKeys(), SUBJECT);
            assert.strictEqual(status, "failed");
            assert.strictEqual(requests.length, 1);
            server.close();
        }
    });

    it("fails without throwing on a timeout, a dead host and bad input", async () => {
        const { endpoint } = await pushService(201, false);
        const keys = generateVapidKeys();
        const { subscription } = browser(endpoint);

        assert.strictEqual(await sendPush(subscription, "x", keys, SUBJECT, { timeout: 50 }), "failed");
        assert.strictEqual(await sendPush(browser("http://localhost:1/").subscription, "x", keys, SUBJECT), "failed");
        assert.strictEqual(await sendPush({ ...subscription, endpoint: "not a url" }, "x", keys, SUBJECT), "failed");
        assert.strictEqual(await sendPush(subscription, "x".repeat(MAX_PUSH_BYTES + 1), keys, SUBJECT), "failed");
    });
});
