import { describe, it } from 'node:test';
import assert from 'node:assert';

import { Codec, MetaJson } from "@papit/meta-json";

describe("codec unit tests", () => {

    it("should encode a message into its simplest form", () => {
        const message = {
            meta: {
                receiver: "bengt",
                sender: "sören",
                type: "something",
                timestamp: Date.now(),
            },
            payload: "payload",
        };

        const encoded = Codec.Encode(message);
        assert.ok(encoded instanceof Uint8Array);
        assert.ok(encoded.byteLength > 0);

        // Decode
        const decoded = Codec.Decode(encoded);

        // Check fields
        assert.strictEqual(decoded.meta.receiver, message.meta.receiver);
        assert.strictEqual(decoded.meta.sender, message.meta.sender);
        assert.strictEqual(decoded.meta.type, message.meta.type);
        // assert.strictEqual(decoded.payload, message.payload);
    });

    it("should encode a message with all extra", () => {
        const message = {
            meta: {
                receiver: "bengt",
                sender: "sören",
                type: "something",
                hopLimit: 520,
                hops: ["sören", "göran", "lennart", "sigvart"],
                relay: "sigvart",
                ttl: 4200,
                timestamp: Date.now(),
            },
            payload: "payload",
        };

        const encoded = Codec.Encode(message);
        assert.ok(encoded instanceof Uint8Array);
        assert.ok(encoded.byteLength > 0);

        // Decode
        const decoded = Codec.Decode(encoded);

        // Check fields
        assert.strictEqual(decoded.meta.receiver, message.meta.receiver);
        assert.strictEqual(decoded.meta.sender, message.meta.sender);
        assert.strictEqual(decoded.meta.type, message.meta.type);
        assert.strictEqual(decoded.meta.hopLimit, message.meta.hopLimit);
        assert.strictEqual(decoded.meta.relay, message.meta.relay);
        assert.strictEqual(decoded.meta.ttl, message.meta.ttl);
        assert.strictEqual(decoded.meta.hops?.length, message.meta.hops?.length);
        // assert.strictEqual(decoded.payload, message.payload);
    });


    it("message reading should be faster then JSON.parse/stringify", () => {
        const message = {
            meta: {
                receiver: "bengt",
                sender: "sören",
                type: "something",
                timestamp: Date.now(),
            },
            payload: {
                a: "3",
                b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b2: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b3: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b4: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b5: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b6: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b7: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b8: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b9: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b10: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b11: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b12: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b13: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b14: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b15: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b16: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b17: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b18: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b19: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b20: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b21: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b22: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b23: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b24: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b25: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b26: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b27: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b28: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b29: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
                b30: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: { b: { a: { b: { a: { b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } },
            },
        };

        // Relay case: a router only needs `meta` to route. Both sides start from bytes/text
        // prepared once up front (payload stringified once, then sent through the codec).
        // codec: Codec.Decode(buf) reading meta only, payload left as a zero-copy view.
        // json:  JSON.parse of the whole JSON.stringify(message), the only way to get at meta.
        function Compare(message) {
            const encoded = Codec.Encode({ meta: message.meta, payload: JSON.stringify(message.payload) });
            const stringified = JSON.stringify(message);

            let codecTotal = 0;
            let jsonTotal = 0;
            for (let i = 0; i < 10_000; i++)
            {
                let start = performance.now();
                Codec.Decode(encoded);
                codecTotal += performance.now() - start;

                start = performance.now();
                JSON.parse(stringified);
                jsonTotal += performance.now() - start;
            }

            return {
                codec: codecTotal / 10_000,
                json: jsonTotal / 10_000,
            };
        }

        const large = Compare(message);
        assert.ok(
            large.codec < large.json,
            `Expected Codec to be faster for large objects (got ${large.codec} vs ${large.json})`
        );

        message.payload = "payload";
        const small = Compare(message);

        console.log("[codec] benchmark", { large, small });

        /**
         * MAC pro m4 - OLD 
         * { large: { codec: 0.002093886700000161, json: 0.1802883460999997 } }
         * { small: { codec: 0.0014421561000003294, json: 0.0006493697999981123 } }
         */


        /**
         * MAC pro m4 - NEW 
         * { large: { codec: 0.0018073924999990594, json: 0.18269669810000122 } }
         * { small: { codec: 0.0013944142999982433, json: 0.0006150142999982108 } }
         */


        /**
         * MAC pro m4 - NEWEST
         * { large: { codec: 0.0019064748999993411, json: 0.18626069090000055 } }
         * { small: { codec: 0.001309877399998777, json: 0.0006500356999973064 } }
         */
    });
});

const text = new TextEncoder();
const bytesOf = (data) => Array.from(data);

// builds a raw buffer: [uint32 BE header][body bytes], header given explicitly
function raw(header, body) {
    const bodyBytes = text.encode(body);
    const buf = new Uint8Array(4 + bodyBytes.length);
    new DataView(buf.buffer).setUint32(0, header, false);
    buf.set(bodyBytes, 4);
    return buf;
}

describe("codec round-trip", () => {

    it("handles empty meta and empty payload", () => {
        const encoded = Codec.Encode({ meta: {}, payload: "" });
        assert.strictEqual(encoded.byteLength, 4 + 2);

        const decoded = Codec.Decode(encoded);
        assert.deepStrictEqual(decoded.meta, {});
        assert.strictEqual(decoded.payload.byteLength, 0);
    });

    it("keeps unicode in meta and payload", () => {
        const meta = { name: "åäö ÅÄÖ 🎉", tags: ["ü", "👋🏽"] };
        const payload = "hej på dig åäö 🎉🚀";

        const decoded = Codec.Decode(Codec.Encode({ meta, payload }));
        assert.deepStrictEqual(decoded.meta, meta);
        assert.strictEqual(new TextDecoder().decode(decoded.payload), payload);
    });

    it("handles a large (~1MB) payload", () => {
        const payload = "abcdefgh".repeat(1 << 17); // 1 MiB
        const decoded = Codec.Decode(Codec.Encode({ meta: { type: "big" }, payload }));

        assert.strictEqual(decoded.meta.type, "big");
        assert.strictEqual(decoded.payload.byteLength, payload.length);
        assert.strictEqual(new TextDecoder().decode(decoded.payload), payload);
    });

    it("parses a nested (stringified) payload with parsePayload", () => {
        const payload = { a: 1, b: { c: [1, "två", { d: null, e: true }] }, f: "🎉" };
        const decoded = Codec.Decode(Codec.Encode({ meta: { type: "nested" }, payload: JSON.stringify(payload) }), true);

        assert.deepStrictEqual(decoded.payload, payload);
    });

    it("round-trips a Uint8Array payload byte-exact", () => {
        const payload = new Uint8Array(256);
        for (let i = 0; i < payload.length; i++) payload[i] = i;

        const decoded = Codec.Decode(Codec.Encode({ meta: { type: "bin" }, payload }));
        assert.deepStrictEqual(bytesOf(decoded.payload), bytesOf(payload));
    });
});

describe("codec binary payload inputs", () => {
    const expected = [1, 2, 3, 250];

    it("encodes an ArrayBuffer as its bytes", () => {
        const payload = new Uint8Array(expected).buffer;
        const decoded = Codec.Decode(Codec.Encode({ meta: {}, payload }));

        assert.deepStrictEqual(bytesOf(decoded.payload), expected);
    });

    it("encodes a DataView as only its viewed bytes", () => {
        const big = new Uint8Array([9, 9, ...expected, 9]);
        const payload = new DataView(big.buffer, 2, expected.length);
        const decoded = Codec.Decode(Codec.Encode({ meta: {}, payload }));

        assert.deepStrictEqual(bytesOf(decoded.payload), expected);
    });

    it("encodes a Uint8Array subarray as only its viewed bytes", () => {
        const big = new Uint8Array([9, 9, ...expected, 9]);
        const payload = big.subarray(2, 2 + expected.length);
        const decoded = Codec.Decode(Codec.Encode({ meta: {}, payload }));

        assert.deepStrictEqual(bytesOf(decoded.payload), expected);
    });
});

describe("Codec.Parse", () => {
    const wrapped = text.encode('XX{"a":1}YY');

    it("parses only the bytes of a Uint8Array subarray", () => {
        assert.deepStrictEqual(Codec.Parse(wrapped.subarray(2, 9)), { a: 1 });
    });

    it("parses only the bytes of a DataView with byteOffset", () => {
        assert.deepStrictEqual(Codec.Parse(new DataView(wrapped.buffer, 2, 7)), { a: 1 });
    });

    it("parses an ArrayBuffer", () => {
        assert.deepStrictEqual(Codec.Parse(text.encode('{"a":1}').buffer), { a: 1 });
    });
});

describe("codec corrupted buffers", () => {

    it("throws RangeError on a buffer shorter than the header", () => {
        assert.throws(() => Codec.Decode(new Uint8Array(0)), RangeError);
        assert.throws(() => Codec.Decode(new Uint8Array(3)), RangeError);
    });

    it("throws RangeError when the header meta length exceeds the buffer", () => {
        // "{}" is valid JSON, so silent truncation would decode without an error
        assert.throws(() => Codec.Decode(raw(100, "{}")), RangeError);
    });

    it("throws SyntaxError on invalid meta JSON", () => {
        assert.throws(() => Codec.Decode(raw(3, "{a}")), SyntaxError);
    });

    it("decodes a Uint8Array that is a subarray of a bigger buffer", () => {
        const encoded = Codec.Encode({ meta: { type: "inner" }, payload: "inner-payload" });
        const big = new Uint8Array(encoded.byteLength + 10).fill(7);
        big.set(encoded, 5);

        const decoded = Codec.Decode(big.subarray(5, 5 + encoded.byteLength));
        assert.deepStrictEqual(decoded.meta, { type: "inner" });
        assert.strictEqual(new TextDecoder().decode(decoded.payload), "inner-payload");
    });
});

describe("MetaJson", () => {

    it("Create does not inject defaults into meta", () => {
        const msg = MetaJson.Create({ type: "chat" }, "hej");

        assert.deepStrictEqual(msg.meta, { type: "chat" });
        assert.strictEqual(msg.payload, "hej");
    });

    it("Create and FromBinary return the subclass", () => {
        class Message extends MetaJson { }

        const created = Message.Create({ type: "ping" }, "{}");
        assert.ok(created instanceof Message);

        const decoded = Message.FromBinary(created.toBinary());
        assert.ok(decoded instanceof Message);
        assert.deepStrictEqual(decoded.meta, { type: "ping" });
    });

    it("parse() parses once and caches", () => {
        const bytes = MetaJson.Create({ type: "x" }, JSON.stringify({ a: [1, 2] })).toBinary();
        const msg = MetaJson.FromBinary(bytes);

        assert.ok(msg.payload instanceof Uint8Array);
        const first = msg.parse();
        assert.deepStrictEqual(first, { a: [1, 2] });
        assert.strictEqual(msg.parse(), first);
        assert.strictEqual(msg.payload, first);
    });

    it("toBinary() caches and toBinary(true) re-encodes after a meta change", () => {
        const msg = MetaJson.Create({ type: "x" }, "payload");
        const first = msg.toBinary();
        assert.strictEqual(msg.toBinary(), first);

        msg.meta.type = "y";
        assert.strictEqual(msg.toBinary(), first);

        const second = msg.toBinary(true);
        assert.notStrictEqual(second, first);
        assert.strictEqual(Codec.Decode(second).meta.type, "y");
    });

    it("relays: change meta without parsing, payload bytes stay identical", () => {
        const payload = JSON.stringify({ text: "hej åäö 🎉", list: [1, 2, 3] });
        const original = MetaJson.Create({ hops: ["a"] }, payload).toBinary();

        const relay = MetaJson.FromBinary(original, false);
        relay.meta.hops.push("b");
        const forwarded = relay.toBinary(true);

        const decoded = Codec.Decode(forwarded);
        assert.deepStrictEqual(decoded.meta, { hops: ["a", "b"] });
        assert.deepStrictEqual(bytesOf(decoded.payload), bytesOf(Codec.Decode(original).payload));
    });
});
