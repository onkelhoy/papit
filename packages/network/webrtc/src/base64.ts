/** Base64 of bytes: how `network.room` carries another network's messages in JSON. */
export function toBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Bytes of base64 `text`; null when it isn't base64. */
export function fromBase64(text: string): Uint8Array | null {
  try
  {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  catch
  {
    return null;
  }
}
