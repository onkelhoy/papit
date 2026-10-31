import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createECDH, randomBytes } from "node:crypto";

import { Arguments } from "@papit/arguments";
import {
    MAX_PUSH_BYTES,
    close,
    createPushRoutes,
    generateVapidKeys,
    openSubscription,
    sealSubscription,
    start,
    validateVapidKeys,
} from "@papit/signal-server";

// ############ HELPERS #####################

const PUBLIC = async () => [{ address: "142.250.74.106" }];
const PRIVATE = async () => [{ address: "10.0.0.1" }];

const servers = [];
const opened = [];

async function listen(handler) {
    const server = http.createServer(handler);
    server.listen(0);
    await once(server, "listening");
    servers.push(server);
    return server.address().port;
}

function subscription(endpoint = "https://push.example.com/abc") {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    return { endpoint, keys: { p256dh: ecdh.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") } };
}

/** The push routes on their own server, resolving every host with `lookup`. */
async function setup(lookup = PUBLIC, options = {}) {
    const keys = generateVapidKeys();
    const routes = createPushRoutes({ keys, subject: "mailto:test@example.com", persistent: true, lookup, rate: 0, ...options });
    opened.push(routes);
    const port = await listen((request, response) => {
        const { pathname } = new URL(request.url, "http://localhost");
        if (routes.handle(request, response, pathname, { "Content-Type": "application/json" })) return;
        response.writeHead(405);
        response.end();
    });

    return { keys, url: `http://localhost:${port}` };
}

/** A local push service answering `status`. */
async function pushService(status) {
    const requests = [];
    const port = await listen((request, response) => {
        request.resume();
        request.on("end", () => {
            requests.push(request.headers);
            response.writeHead(status);
            response.end();
        });
    });
    return { requests, endpoint: `http://localhost:${port}/push` };
}

const post = (url, body) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
});

afterEach(() => {
    close();
    for (const routes of opened.splice(0)) routes.close();
    for (const server of servers.splice(0))
    {
        server.closeAllConnections();
        server.close();
    }
    for (const flag of ["port", "no-push", "allow-origin", "allow-private", "vapid-subject", "push-rate", "trust-proxy"]) Arguments.delete(flag);
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
});

// ############ TESTS #####################

describe("routes", { timeout: 5000 }, () => {

    it("gives out the public key", async () => {
        const { keys, url } = await setup();
        const response = await fetch(`${url}/push/key`);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { key: keys.publicKey, persistent: true });
    });

    it("leaves other paths to the caller", async () => {
        const { url } = await setup();
        assert.strictEqual((await fetch(`${url}/push/other`)).status, 405);
        assert.strictEqual((await fetch(`${url}/push/send`)).status, 405);
    });

    it("seals a subscription into a token", async () => {
        const { keys, url } = await setup();
        const sub = subscription();

        const response = await post(`${url}/push/subscribe`, { subscription: { ...sub, expirationTime: null } });
        const { token } = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(openSubscription(token, keys), sub);
    });

    it("refuses invalid subscriptions and private endpoints", async () => {
        const open = await setup();
        const invalid = await post(`${open.url}/push/subscribe`, { subscription: subscription("http://push.example.com/") });
        assert.strictEqual(invalid.status, 400);

        const closed = await setup(PRIVATE);
        const internal = await post(`${closed.url}/push/subscribe`, { subscription: subscription() });
        assert.strictEqual(internal.status, 400);
    });

    it("refuses bodies that are not JSON objects", async () => {
        const { url } = await setup();
        for (const body of ["", "not json", "null", "42"])
        {
            const response = await post(`${url}/push/subscribe`, body);
            assert.strictEqual(response.status, 400, body);
            assert.strictEqual(typeof (await response.json()).error, "string");
        }
    });

    it("refuses an oversized body", async () => {
        const { url } = await setup();
        const response = await post(`${url}/push/subscribe`, { padding: "x".repeat(64 * 1024) });
        assert.strictEqual(response.status, 413);
    });

    it("sends a push from a token", async () => {
        const { keys, url } = await setup();
        const { requests, endpoint } = await pushService(201);
        const token = sealSubscription(subscription(endpoint), keys);

        const response = await post(`${url}/push/send`, { token, payload: { type: "call" }, ttl: 30, urgency: "low" });

        assert.deepStrictEqual(await response.json(), { status: "sent" });
        assert.strictEqual(requests[0].ttl, "30");
        assert.strictEqual(requests[0].urgency, "low");
        assert.strictEqual(requests[0]["content-encoding"], "aes128gcm");
    });

    it("ignores options that are not the client's to set", async () => {
        const { keys, url } = await setup();
        const { endpoint } = await pushService(201);
        const token = sealSubscription(subscription(endpoint), keys);

        const response = await post(`${url}/push/send`, { token, payload: "ring", timeout: "nonsense" });
        assert.deepStrictEqual(await response.json(), { status: "sent" });
    });

    it("tells the caller when a subscription is gone", async () => {
        const { keys, url } = await setup();
        const { endpoint } = await pushService(410);
        const token = sealSubscription(subscription(endpoint), keys);

        const response = await post(`${url}/push/send`, { token, payload: "ring" });
        assert.deepStrictEqual(await response.json(), { status: "gone" });
    });

    it("refuses a bad send", async () => {
        const { keys, url } = await setup();
        const token = sealSubscription(subscription(), keys);

        for (const [body, status] of [
            [{ payload: 1 }, 400],
            [{ token: 42, payload: 1 }, 400],
            [{ token: "nonsense", payload: 1 }, 400],
            [{ token: sealSubscription(subscription(), generateVapidKeys()), payload: 1 }, 400],
            [{ token }, 400],
            [{ token, payload: 1, ttl: -1 }, 400],
            [{ token, payload: 1, ttl: 1.5 }, 400],
            [{ token, payload: 1, ttl: "60" }, 400],
            [{ token, payload: 1, urgency: "now" }, 400],
            [{ token, payload: "x".repeat(MAX_PUSH_BYTES) }, 413],
        ])
        {
            assert.strictEqual((await post(`${url}/push/send`, body)).status, status);
        }
    });

    it("does not call a host that turned private after the token was made", async () => {
        const { keys, url } = await setup(PRIVATE);
        const { requests, endpoint } = await pushService(201);
        const token = sealSubscription(subscription(endpoint), keys);

        const response = await post(`${url}/push/send`, { token, payload: "ring" });

        assert.deepStrictEqual(await response.json(), { status: "failed" });
        assert.strictEqual(requests.length, 0);
    });
});

describe("rate limit", { timeout: 5000 }, () => {
    const body = { subscription: subscription() };

    it("answers 429 once a client has spent its budget, GET stays open", async () => {
        const { url } = await setup(PUBLIC, { rate: 2 });

        assert.strictEqual((await post(`${url}/push/subscribe`, body)).status, 200);
        assert.strictEqual((await post(`${url}/push/subscribe`, body)).status, 200);

        const refused = await post(`${url}/push/subscribe`, body);
        assert.strictEqual(refused.status, 429);
        assert.strictEqual(typeof (await refused.json()).error, "string");
        assert.strictEqual((await fetch(`${url}/push/key`)).status, 200);
    });

    it("ignores x-forwarded-for unless told there is a proxy", async () => {
        const { url } = await setup(PUBLIC, { rate: 1 });
        const from = (address) => fetch(`${url}/push/subscribe`, {
            method: "POST",
            headers: { "X-Forwarded-For": address },
            body: JSON.stringify(body),
        });

        assert.strictEqual((await from("1.1.1.1")).status, 200);
        assert.strictEqual((await from("2.2.2.2")).status, 429);
    });

    it("counts clients apart behind a proxy, and a forged prefix changes nothing", async () => {
        const { url } = await setup(PUBLIC, { rate: 1, trustProxy: 1 });
        const from = (address) => fetch(`${url}/push/subscribe`, {
            method: "POST",
            headers: { "X-Forwarded-For": address },
            body: JSON.stringify(body),
        });

        assert.strictEqual((await from("1.1.1.1")).status, 200);
        assert.strictEqual((await from("2.2.2.2")).status, 200);
        assert.strictEqual((await from("9.9.9.9, 1.1.1.1")).status, 429);
    });
});

describe("config", { timeout: 5000 }, () => {

    async function serve() {
        Arguments.set("port", "0");
        const server = start();
        await once(server, "listening");
        return `http://localhost:${server.address().port}`;
    }

    it("is on by default, with throwaway keys", async () => {
        const url = await serve();
        const { key, persistent } = await (await fetch(`${url}/push/key`)).json();

        assert.strictEqual(persistent, false);
        assert.strictEqual(Buffer.from(key, "base64url").length, 65);
    });

    it("uses the keys from the environment", async () => {
        const keys = generateVapidKeys();
        process.env.VAPID_PUBLIC_KEY = keys.publicKey;
        process.env.VAPID_PRIVATE_KEY = keys.privateKey;

        const url = await serve();
        assert.deepStrictEqual(await (await fetch(`${url}/push/key`)).json(), { key: keys.publicKey, persistent: true });
    });

    it("has no push routes with --no-push", async () => {
        Arguments.set("no-push", true);
        const url = await serve();

        assert.strictEqual((await fetch(`${url}/push/key`)).status, 405);
        assert.strictEqual((await fetch(`${url}/health`)).status, 200);
    });

    it("refuses a local push service by default", async () => {
        const url = await serve();
        const { endpoint } = await pushService(201);

        const response = await post(`${url}/push/subscribe`, { subscription: subscription(endpoint) });
        assert.strictEqual(response.status, 400);
    });

    it("subscribes and pushes through a local push service with --allow-private", async () => {
        Arguments.set("allow-private", true);
        const url = await serve();
        const { requests, endpoint } = await pushService(201);

        const subscribed = await post(`${url}/push/subscribe`, { subscription: subscription(endpoint) });
        const { token } = await subscribed.json();
        const sent = await post(`${url}/push/send`, { token, payload: { type: "call" } });

        assert.deepStrictEqual(await sent.json(), { status: "sent" });
        assert.strictEqual(requests.length, 1);
    });

    it("limits by --push-rate and a bare --trust-proxy means one proxy", async () => {
        Arguments.set("push-rate", "1");
        Arguments.set("trust-proxy", true);
        const url = await serve();
        const from = async (address) => (await fetch(`${url}/push/subscribe`, {
            method: "POST",
            headers: { "X-Forwarded-For": address },
            body: "{}",
        })).status;

        assert.strictEqual(await from("1.1.1.1"), 400);
        assert.strictEqual(await from("2.2.2.2"), 400);
        assert.strictEqual(await from("1.1.1.1"), 429);
    });

    it("refuses to start on bad config", () => {
        const keys = generateVapidKeys();

        process.env.VAPID_PUBLIC_KEY = keys.publicKey;
        assert.throws(() => start(), /both/);

        process.env.VAPID_PRIVATE_KEY = generateVapidKeys().privateKey;
        assert.throws(() => start(), /not a pair/);

        process.env.VAPID_PRIVATE_KEY = keys.privateKey;
        process.env.VAPID_SUBJECT = "someone";
        assert.throws(() => start(), /subject/);
    });

    it("allows any origin by default, for preflighted POSTs too", async () => {
        const url = await serve();
        const response = await fetch(`${url}/push/send`, { method: "OPTIONS" });

        assert.strictEqual(response.headers.get("access-control-allow-origin"), "*");
        assert.match(response.headers.get("access-control-allow-methods"), /POST/);
        assert.match(response.headers.get("access-control-allow-headers"), /Content-Type/);
    });

    it("narrows CORS with --allow-origin", async () => {
        Arguments.set("allow-origin", "https://a.example,https://b.example");
        const url = await serve();
        const origin = async (value) => (await fetch(`${url}/health`, { headers: { Origin: value } })).headers.get("access-control-allow-origin");

        assert.strictEqual(await origin("https://b.example"), "https://b.example");
        assert.strictEqual(await origin("https://evil.example"), "https://a.example");
    });

    it("prints a key pair with --generate-vapid and exits", async () => {
        const bin = fileURLToPath(new URL("../../lib/bin.js", import.meta.url));
        const { stdout } = await promisify(execFile)(process.execPath, [bin, "--generate-vapid"]);

        const publicKey = /VAPID_PUBLIC_KEY=(\S+)/.exec(stdout)[1];
        const privateKey = /VAPID_PRIVATE_KEY=(\S+)/.exec(stdout)[1];
        assert.doesNotThrow(() => validateVapidKeys({ publicKey, privateKey }));
    });
});
