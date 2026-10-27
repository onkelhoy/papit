import type { BufferSource, MessageType } from "./types";

/**
 * Static encoder/decoder for the meta-json binary layout:
 * `[uint32 BE meta length][meta JSON, UTF-8][payload bytes]`.
 */
export class Codec {
    private static encoder = new TextEncoder();
    private static decoder = new TextDecoder();

    /** Decodes UTF-8 bytes and `JSON.parse`s them. A view reads only its own `byteOffset`/`byteLength` range. */
    static Parse<Payload>(payload: BufferSource) {
        return JSON.parse(Codec.decoder.decode(Codec.Bytes(payload))) as Payload;
    }

    private static Bytes(data: BufferSource): Uint8Array {
        if (data instanceof Uint8Array) return data;
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    /**
     * Packs a message into one buffer. A binary payload (`ArrayBuffer` or any view) is copied
     * as its bytes, a string as UTF-8; anything else goes through `String()`, so stringify objects first.
     */
    static Encode<Meta extends Object = object, Payload = string>(message: MessageType<Meta, Payload>): Uint8Array {
        // Encoding
        const meta = JSON.stringify(message.meta);
        const metaBytes = Codec.encoder.encode(meta);
        const payload = message.payload as unknown;
        const payloadBytes = payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)
            ? Codec.Bytes(payload)
            : Codec.encoder.encode(String(payload));

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
     * @throws RangeError when the buffer is shorter than the 4-byte header, or the header's meta length runs past its end
     * @throws SyntaxError when the meta (or a parsed payload) is not valid JSON
     */
    static Decode<Meta extends Object = object, Payload = any>(data: Uint8Array, parsePayload?: boolean): MessageType<Meta, Payload | BufferSource> {
        if (data.byteLength < 4)
        {
            throw new RangeError(`meta-json: buffer is ${data.byteLength} bytes, shorter than the 4-byte header`);
        }

        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const metaLen = view.getUint32(0, false);
        if (metaLen > data.byteLength - 4)
        {
            throw new RangeError(`meta-json: header meta length ${metaLen} exceeds the ${data.byteLength - 4} bytes after the header`);
        }

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