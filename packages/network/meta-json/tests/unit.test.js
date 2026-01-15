import { describe, it } from 'node:test';
import assert from 'node:assert';

import { Codec } from "@papit/meta-json";

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

        function Compare(message) {
            let codecTotal = 0;
            let jsonTotal = 0;
            for (let i = 0; i < 10_000; i++)
            {
                let start = performance.now();
                const encoded = Codec.Encode(message);
                Codec.Decode(encoded);
                codecTotal += performance.now() - start;

                start = performance.now();
                const stringified = JSON.stringify(message);
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
        assert.ok(
            small.codec > small.json,
            `Expected JSON to be faster for small objects (got ${small.codec} vs ${small.json})`
        );

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