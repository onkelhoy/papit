import { describe, it } from "node:test";
import assert from "node:assert";

import { MetaJson } from "@papit/meta-json";
import { Message, relay, SERVER, BROADCAST, DEFAULT_TTL, MAX_MESSAGE_BYTES } from "@papit/peer-message";

describe("constants", () => {
    it("has the protocol values", () => {
        assert.strictEqual(SERVER, "server");
        assert.strictEqual(BROADCAST, "*");
        assert.strictEqual(DEFAULT_TTL, 16);
        assert.strictEqual(MAX_MESSAGE_BYTES, 256 * 1024);
    });
});

describe("Message.Create", () => {

    it("fills in defaults", () => {
        const before = Date.now();
        const msg = Message.Create({ type: "chat" }, "hej");

        assert.ok(msg instanceof Message);
        assert.ok(msg instanceof MetaJson);
        assert.strictEqual(typeof msg.meta.id, "string");
        assert.ok(msg.meta.id.length > 0 && msg.meta.id.length <= 64);
        assert.strictEqual(msg.meta.type, "chat");
        assert.strictEqual(msg.meta.sender, "");
        assert.strictEqual(msg.meta.receiver, SERVER);
        assert.ok(msg.meta.timestamp >= before && msg.meta.timestamp <= Date.now());
        assert.strictEqual(msg.meta.ttl, DEFAULT_TTL);
        assert.deepStrictEqual(msg.meta.hops, []);
        assert.strictEqual(msg.meta.network, undefined);
        assert.strictEqual(msg.payload, "hej");
    });

    it("starts hops with the sender", () => {
        const msg = Message.Create({ type: "chat", sender: "a", receiver: "b" }, "");
        assert.deepStrictEqual(msg.meta.hops, ["a"]);
        assert.strictEqual(msg.meta.receiver, "b");
    });

    it("lets given fields override the defaults", () => {
        const msg = Message.Create({ type: "chat", id: "fixed", ttl: 3, timestamp: 5, hops: ["x", "y"], network: "n1" }, "");
        assert.strictEqual(msg.meta.id, "fixed");
        assert.strictEqual(msg.meta.ttl, 3);
        assert.strictEqual(msg.meta.timestamp, 5);
        assert.deepStrictEqual(msg.meta.hops, ["x", "y"]);
        assert.strictEqual(msg.meta.network, "n1");
    });

    it("generates a unique id per message", () => {
        const ids = new Set();
        for (let i = 0; i < 1000; i++) ids.add(Message.Create({ type: "x" }, "").meta.id);
        assert.strictEqual(ids.size, 1000);
    });

    it("falls back when crypto.randomUUID is missing", () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
        Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true });
        try
        {
            const a = Message.Create({ type: "x" }, "").meta.id;
            const b = Message.Create({ type: "x" }, "").meta.id;
            assert.strictEqual(typeof a, "string");
            assert.ok(a.length > 0 && a.length <= 64);
            assert.notStrictEqual(a, b);
        }
        finally
        {
            Object.defineProperty(globalThis, "crypto", original);
        }
    });
});

describe("Message round-trip", () => {

    it("survives encode and decode", () => {
        const payload = { text: "hej åäö 🎉" };
        const msg = Message.Create({ type: "chat", sender: "a", receiver: "b", network: "n" }, JSON.stringify(payload));

        const decoded = Message.FromBinary(msg.toBinary());
        assert.ok(decoded instanceof Message);
        assert.deepStrictEqual(decoded.meta, msg.meta);
        assert.deepStrictEqual(decoded.parse(), payload);
    });
});

describe("Message payload encoding", () => {

    it("encodes an object payload as JSON", () => {
        const msg = Message.Create({ type: "chat" }, { text: "hej" });
        assert.deepStrictEqual(Message.FromBinary(msg.toBinary()).parse(), { text: "hej" });
        assert.deepStrictEqual(msg.payload, { text: "hej" });
    });

    it("re-encodes a parsed payload as JSON when relayed", () => {
        const payload = { description: { type: "offer", sdp: "v=0" } };
        const sent = Message.Create({ type: "handshake.offer", sender: "a", receiver: "c" }, JSON.stringify(payload));

        const received = Message.FromBinary(sent.toBinary());
        received.parse();
        relay(received.meta, "b");

        const forwarded = Message.FromBinary(received.toBinary(true));
        assert.deepStrictEqual(forwarded.meta.hops, ["a", "b"]);
        assert.deepStrictEqual(forwarded.parse(), payload);
    });

    it("keeps string and binary payloads as they are", () => {
        const text = Message.FromBinary(Message.Create({ type: "x" }, "raw").toBinary());
        assert.strictEqual(new TextDecoder().decode(text.payload), "raw");

        const bytes = Message.FromBinary(Message.Create({ type: "x" }, new Uint8Array([0, 255])).toBinary());
        assert.deepStrictEqual(Array.from(bytes.payload), [0, 255]);
    });
});
