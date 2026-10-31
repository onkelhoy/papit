import { createECDH, createPrivateKey, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";

import type { VapidKeys } from "../types";

const CURVE = "prime256v1";
const PUBLIC_KEY_BYTES = 65;
const PRIVATE_KEY_BYTES = 32;
// push services refuse tokens that live longer than 24 hours
const TOKEN_SECONDS = 12 * 60 * 60;

const base64url = (data: string | Uint8Array) => Buffer.from(data).toString("base64url");

/** Creates a new VAPID key pair. */
export function generateVapidKeys(): VapidKeys {
    const ecdh = createECDH(CURVE);
    ecdh.generateKeys();
    return {
        publicKey: base64url(ecdh.getPublicKey()),
        privateKey: base64url(ecdh.getPrivateKey()),
    };
}

/** Throws unless `keys` is a matching P-256 pair, so bad config fails at start and not on the first push. */
export function validateVapidKeys(keys: VapidKeys) {
    const publicKey = Buffer.from(keys.publicKey, "base64url");
    const privateKey = Buffer.from(keys.privateKey, "base64url");
    if (publicKey.length !== PUBLIC_KEY_BYTES) throw new Error(`VAPID public key must be ${PUBLIC_KEY_BYTES} bytes`);
    if (privateKey.length !== PRIVATE_KEY_BYTES) throw new Error(`VAPID private key must be ${PRIVATE_KEY_BYTES} bytes`);

    const ecdh = createECDH(CURVE);
    ecdh.setPrivateKey(privateKey);
    if (!ecdh.getPublicKey().equals(publicKey)) throw new Error("VAPID keys are not a pair");
}

/**
 * `Authorization` header for a push to `endpoint` (RFC 8292).
 * `subject` is a `mailto:` or `https:` contact for the push service. `now` is in seconds.
 */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, now = Math.floor(Date.now() / 1000)) {
    const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
    const claims = base64url(JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: now + TOKEN_SECONDS,
        sub: subject,
    }));

    const unsigned = `${header}.${claims}`;
    const signature = sign("sha256", Buffer.from(unsigned), { key: signingKey(keys), dsaEncoding: "ieee-p1363" });
    return `vapid t=${unsigned}.${base64url(signature)}, k=${keys.publicKey}`;
}

function signingKey(keys: VapidKeys): KeyObject {
    const point = Buffer.from(keys.publicKey, "base64url");
    return createPrivateKey({
        format: "jwk",
        key: {
            kty: "EC",
            crv: "P-256",
            d: keys.privateKey,
            x: base64url(point.subarray(1, 33)),
            y: base64url(point.subarray(33)),
        },
    });
}
