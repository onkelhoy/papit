import type { BufferSource, MessageType } from "./types";

/**
 * Static encoder/decoder for the meta-json binary layout:
 * `[uint32 BE meta length][meta JSON, UTF-8][payload bytes]`.
 */
export class Codec {
    private static encoder = new TextEncoder();
    private static decoder = new TextDecoder();

    /** Decodes UTF-8 bytes and `JSON.parse`s them. */
    static Parse<Payload>(payload: BufferSource) {
        const bytes =
            payload instanceof Uint8Array
                ? payload
                : new Uint8Array(
                    payload instanceof ArrayBuffer
                        ? payload
                        : payload.buffer
                );

        return JSON.parse(Codec.decoder.decode(bytes)) as Payload;
    }

    /**
     * Packs a message into one buffer. A `Uint8Array` payload is copied as-is;
     * anything else goes through `String()`, so stringify objects first.
     */
    static Encode<Meta extends Object = object, Payload = string>(message: MessageType<Meta, Payload>): Uint8Array {
        // Encoding
        const meta = JSON.stringify(message.meta);
        const metaBytes = Codec.encoder.encode(meta);
        const payloadBytes = message.payload instanceof Uint8Array
            ? message.payload
            : Codec.encoder.encode(String(message.payload));

        const buf = new Uint8Array(4 + metaBytes.length + payloadBytes.length);
        const view = new DataView(buf.buffer);

        view.setUint32(0, metaBytes.length, false);
        buf.set(metaBytes, 4);
        buf.set(payloadBytes, 4 + metaBytes.length);

        return buf;
    }

    /**
     * Unpacks a buffer made by `Encode`. The payload is a zero-copy `Uint8Array` view
     * unless `parsePayload` is true, then it is `JSON.parse`d.
     * @throws RangeError when the buffer is shorter than the 4-byte header
     * @throws SyntaxError when the meta (or a parsed payload) is not valid JSON
     */
    static Decode<Meta extends Object = object, Payload = any>(data: Uint8Array, parsePayload?: boolean): MessageType<Meta, Payload | BufferSource> {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const metaLen = view.getUint32(0, false);

        // zero-copy: create a view into the existing buffer for the meta section
        const metaBytes = data.subarray(4, 4 + metaLen);
        const metaStr = Codec.decoder.decode(metaBytes);
        const meta = JSON.parse(metaStr);

        // zero-copy: payload view
        let payload: BufferSource | Payload;
        const rawPayload = data.subarray(4 + metaLen);
        if (parsePayload)
        {
            payload = Codec.Parse<Payload>(rawPayload);
        }
        else 
        {
            payload = rawPayload;
        }

        return {
            meta,
            payload,
        };
    }
}