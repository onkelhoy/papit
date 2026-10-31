import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import type { PushSubscription, VapidKeys } from "../types";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_INFO = Buffer.from("papit signal-server push token");

// no secret of its own: new VAPID keys void every subscription, so its tokens may as well go too
const tokenKey = (keys: VapidKeys) => {
    return Buffer.from(hkdfSync("sha256", Buffer.from(keys.privateKey, "base64url"), Buffer.alloc(0), KEY_INFO, 32));
}

/**
 * Encrypts `subscription` into a token only this server can read, so it can be handed out instead of stored.
 * Whoever holds the token can push to that browser.
 */
export function sealSubscription(subscription: PushSubscription, keys: VapidKeys): string {
    const { endpoint, keys: { p256dh, auth } } = subscription;

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", tokenKey(keys), iv);
    const body = Buffer.concat([cipher.update(JSON.stringify({ endpoint, keys: { p256dh, auth } })), cipher.final()]);
    return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** The subscription inside `token`, or null when it is malformed, tampered with or sealed with other keys. */
export function openSubscription(token: string, keys: VapidKeys): PushSubscription | null {
    try
    {
        const data = Buffer.from(token, "base64url");
        const decipher = createDecipheriv("aes-256-gcm", tokenKey(keys), data.subarray(0, IV_BYTES));
        decipher.setAuthTag(data.subarray(-TAG_BYTES));
        const body = data.subarray(IV_BYTES, -TAG_BYTES);
        return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString());
    }
    catch
    {
        return null;
    }
}
