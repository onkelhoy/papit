import { KEY_PREFIX } from "@papit/peer-message";

const encoder = new TextEncoder();

/** The first 32 bits of SHA-1(UTF-8 `text`). Sync, so topologies can hash keys inline. */
export function keyHash(text: string): number {
  const bytes = encoder.encode(text);
  // padding: 0x80, zeros, then the bit length as 64 bits
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(length - 4, (bytes.length * 8) >>> 0);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  for (let offset = 0; offset < length; offset += 64)
  {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++)
    {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }

      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }

  return h0 >>> 0;
}

/** The key receiver for `key`: `"@"` + the 8 hex digits of `keyHash(key)`. */
export function keyReceiver(key: string) {
  return KEY_PREFIX + keyHash(key).toString(16).padStart(8, "0");
}

/** SHA-256 hex of `text`, what a registry sees of a network key. */
export async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 32-bit FNV-1a of UTF-8 `text`: cheap, sync, for placing ids on a ring. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of encoder.encode(text))
  {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
