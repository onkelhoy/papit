import { createCipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";

import type { PushSubscription } from "../types";

const CURVE = "prime256v1";
const RECORD_BYTES = 4096;
const SALT_BYTES = 16;
const PUBLIC_KEY_BYTES = 65;
const AUTH_BYTES = 16;
// header (86) and the padding delimiter + auth tag (17) have to fit a 4096 byte message
const HEADER_BYTES = SALT_BYTES + 4 + 1 + PUBLIC_KEY_BYTES;

/** Largest payload a push can carry, in bytes. */
export const MAX_PUSH_BYTES = RECORD_BYTES - HEADER_BYTES - 17;

/** Fixed sender key and salt, only for reproducing the RFC 8291 example. */
export type EncryptSeed = { privateKey: string; salt: string };

const hkdf = (key: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) => {
    return Buffer.from(hkdfSync("sha256", key, salt, info, length));
}

/**
 * Encrypts `payload` for one browser (RFC 8291, `aes128gcm` from RFC 8188), so the push service can't read it.
 * Throws when the subscription keys are malformed or the payload is over `MAX_PUSH_BYTES`.
 */
export function encryptPush(payload: string | Uint8Array, subscription: PushSubscription, seed?: EncryptSeed): Buffer {
    const plaintext = Buffer.from(payload as Uint8Array);
    if (plaintext.length > MAX_PUSH_BYTES) throw new RangeError(`push payload is over ${MAX_PUSH_BYTES} bytes`);

    const receiver = Buffer.from(subscription.keys.p256dh, "base64url");
    const auth = Buffer.from(subscription.keys.auth, "base64url");
    if (receiver.length !== PUBLIC_KEY_BYTES) throw new Error(`p256dh must be ${PUBLIC_KEY_BYTES} bytes`);
    if (auth.length !== AUTH_BYTES) throw new Error(`auth must be ${AUTH_BYTES} bytes`);

    const ecdh = createECDH(CURVE);
    if (seed) ecdh.setPrivateKey(Buffer.from(seed.privateKey, "base64url"));
    else ecdh.generateKeys();
    const sender = ecdh.getPublicKey();
    const salt = seed ? Buffer.from(seed.salt, "base64url") : randomBytes(SALT_BYTES);

    const secret = ecdh.computeSecret(receiver);
    const info = Buffer.concat([Buffer.from("WebPush: info\0"), receiver, sender]);
    const ikm = hkdf(secret, auth, info, 32);
    const key = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
    const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

    // one record, so it ends with the 0x02 delimiter of a last record
    const cipher = createCipheriv("aes-128-gcm", key, nonce);
    const body = Buffer.concat([cipher.update(plaintext), cipher.update(Buffer.from([2])), cipher.final(), cipher.getAuthTag()]);

    const size = Buffer.alloc(4);
    size.writeUInt32BE(RECORD_BYTES);
    return Buffer.concat([salt, size, Buffer.from([sender.length]), sender, body]);
}
