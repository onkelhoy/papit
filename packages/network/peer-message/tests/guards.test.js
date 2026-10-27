import { describe, it } from "node:test";
import assert from "node:assert";

import { Codec } from "@papit/meta-json";
import {
    Message,
    isMeta,
    isPayload,
    isReserved,
    read,
    SignalType,
    NetworkType,
    HandshakeType,
    MAX_MESSAGE_BYTES,
} from "@papit/peer-message";

const meta = (over = {}) => ({
    id: "m1",
    type: "chat",
    sender: "a",
    receiver: "b",
    timestamp: 1,
    ttl: 4,
    hops: ["a"],
    ...over,
});

const network = {
    id: "n1",
    name: "lobby",
    host: "a",
    topology: "mesh",
    private: false,
    size: 2,
};

const long = "x".repeat(65);

describe("isReserved", () => {
    it("reserves the protocol prefixes only", () => {
        assert.strictEqual(isReserved("signal.join"), true);
        assert.strictEqual(isReserved("network.leave"), true);
        assert.strictEqual(isReserved("handshake.offer"), true);
        assert.strictEqual(isReserved("signal.whatever"), true);
        assert.strictEqual(isReserved("chat"), false);
        assert.strictEqual(isReserved("signals"), false);
        assert.strictEqual(isReserved("app.signal.join"), false);
    });
});

describe("type enums", () => {
    it("use the namespaced wire values", () => {
        assert.strictEqual(SignalType.Register, "signal.register");
        assert.strictEqual(SignalType.Unreachable, "signal.unreachable");
        assert.strictEqual(NetworkType.Welcome, "network.welcome");
        assert.strictEqual(HandshakeType.Candidate, "handshake.candidate");
    });
});

describe("isMeta", () => {

    it("accepts a valid meta", () => {
        assert.strictEqual(isMeta(meta()), true);
        assert.strictEqual(isMeta(meta({ network: "n1", sender: "", hops: [], ttl: 0 })), true);
        assert.strictEqual(isMeta(meta({ ttl: 255, id: "x".repeat(64), hops: Array(256).fill("h") })), true);
    });

    it("rejects non-objects", () => {
        for (const x of [null, undefined, 1, "meta", [], true])
        {
            assert.strictEqual(isMeta(x), false, String(x));
        }
    });

    const bad = {
        "missing id": { id: undefined },
        "empty id": { id: "" },
        "id not a string": { id: 1 },
        "id too long": { id: long },
        "missing type": { type: undefined },
        "empty type": { type: "" },
        "type not a string": { type: 2 },
        "sender not a string": { sender: null },
        "sender too long": { sender: long },
        "missing receiver": { receiver: undefined },
        "receiver too long": { receiver: long },
        "network not a string": { network: 3 },
        "network too long": { network: long },
        "timestamp missing": { timestamp: undefined },
        "timestamp NaN": { timestamp: NaN },
        "timestamp Infinity": { timestamp: Infinity },
        "timestamp string": { timestamp: "1" },
        "ttl missing": { ttl: undefined },
        "ttl negative": { ttl: -1 },
        "ttl over 255": { ttl: 256 },
        "ttl fractional": { ttl: 1.5 },
        "ttl string": { ttl: "4" },
        "hops missing": { hops: undefined },
        "hops not an array": { hops: "a" },
        "hops with a non-string": { hops: ["a", 2] },
        "hops entry too long": { hops: [long] },
        "too many hops": { hops: Array(257).fill("h") },
    };

    for (const [name, over] of Object.entries(bad))
    {
        it(`rejects ${name}`, () => {
            assert.strictEqual(isMeta(meta(over)), false);
        });
    }
});

describe("isPayload", () => {

    const valid = {
        [SignalType.Register]: { name: "lobby", topology: "mesh", private: true, password: "pw", meta: { game: "x" } },
        [SignalType.Update]: { network: "n1", name: "new" },
        [SignalType.Unregister]: { network: "n1" },
        [SignalType.List]: {},
        [SignalType.Join]: { network: "n1", password: "pw" },
        [SignalType.Leave]: { network: "n1" },
        [SignalType.Welcome]: { id: "me" },
        [SignalType.Registered]: { network },
        [SignalType.Updated]: { network: { ...network, meta: { a: 1 } } },
        [SignalType.Networks]: { networks: [network, network] },
        [SignalType.Host]: { network },
        [SignalType.Unreachable]: { receiver: "b", ref: "m1" },
        [SignalType.Error]: { code: "not-found", message: "no such network", ref: "m1" },
        [NetworkType.Join]: {},
        [NetworkType.Welcome]: { network, members: ["a", "b"], connect: ["a"] },
        [NetworkType.Reject]: { reason: "full" },
        [NetworkType.Members]: { members: ["a"] },
        [NetworkType.Leave]: { peer: "a" },
        [HandshakeType.Offer]: { description: { type: "offer", sdp: "v=0" } },
        [HandshakeType.Answer]: { description: { type: "answer", sdp: "v=0" } },
        [HandshakeType.Candidate]: { candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 } },
    };

    const invalid = {
        [SignalType.Register]: { name: "lobby" },
        [SignalType.Update]: { name: "new" },
        [SignalType.Unregister]: {},
        [SignalType.List]: null,
        [SignalType.Join]: { network: "n1", password: 1 },
        [SignalType.Leave]: { network: 1 },
        [SignalType.Welcome]: {},
        [SignalType.Registered]: { network: { ...network, size: "2" } },
        [SignalType.Updated]: { network: { ...network, private: "no" } },
        [SignalType.Networks]: { networks: [network, { id: "n2" }] },
        [SignalType.Host]: {},
        [SignalType.Unreachable]: { receiver: "b" },
        [SignalType.Error]: { code: "x" },
        [NetworkType.Join]: { password: 5 },
        [NetworkType.Welcome]: { network, members: ["a", 1], connect: [] },
        [NetworkType.Reject]: {},
        [NetworkType.Members]: { members: "a" },
        [NetworkType.Leave]: {},
        [HandshakeType.Offer]: { description: "v=0" },
        [HandshakeType.Answer]: {},
        [HandshakeType.Candidate]: { candidate: "candidate:1" },
    };

    for (const type of Object.keys(valid))
    {
        it(`checks ${type}`, () => {
            assert.strictEqual(isPayload(type, valid[type]), true, "valid");
            assert.strictEqual(isPayload(type, invalid[type]), false, "invalid");
        });
    }

    it("checks the optional host on network.members", () => {
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a", "b"], host: "b" }), true);
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a"], host: 1 }), false);
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a"], host: "" }), false);
    });

    it("rejects unknown reserved types", () => {
        assert.strictEqual(isPayload("signal.nope", {}), false);
    });
});

describe("read", () => {

    const bytes = (msg) => msg.toBinary();

    it("reads a valid app message and keeps the payload unparsed", () => {
        const sent = Message.Create({ type: "chat", sender: "a", receiver: "b" }, JSON.stringify({ text: "hej" }));
        const msg = read(bytes(sent));

        assert.ok(msg instanceof Message);
        assert.deepStrictEqual(msg.meta, sent.meta);
        assert.ok(msg.payload instanceof Uint8Array);
        assert.deepStrictEqual(msg.parse(), { text: "hej" });
    });

    it("keeps an app payload unparsed even when it is not JSON", () => {
        const sent = Message.Create({ type: "file" }, new Uint8Array([0, 255, 1]));
        const msg = read(bytes(sent));

        assert.ok(msg);
        assert.deepStrictEqual(Array.from(msg.payload), [0, 255, 1]);
    });

    it("parses and checks reserved payloads", () => {
        const sent = Message.Create({ type: SignalType.Join }, JSON.stringify({ network: "n1" }));
        const msg = read(bytes(sent));

        assert.ok(msg);
        assert.deepStrictEqual(msg.payload, { network: "n1" });
    });

    it("accepts an ArrayBuffer", () => {
        const encoded = bytes(Message.Create({ type: "chat" }, "x"));
        const copy = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
        assert.ok(read(copy));
    });

    it("returns null for oversized input", () => {
        const sent = bytes(Message.Create({ type: "chat" }, "x".repeat(100)));
        assert.strictEqual(read(sent, sent.byteLength - 1), null);
        assert.ok(read(sent, sent.byteLength));

        const big = bytes(Message.Create({ type: "chat" }, "x".repeat(MAX_MESSAGE_BYTES)));
        assert.strictEqual(read(big), null);
    });

    it("returns null for truncated input", () => {
        const sent = bytes(Message.Create({ type: "chat" }, "payload"));
        assert.strictEqual(read(sent.subarray(0, 3)), null);
        assert.strictEqual(read(sent.subarray(0, 10)), null);
    });

    it("returns null for garbage", () => {
        assert.strictEqual(read(new Uint8Array([0, 0, 0, 3, 1, 2, 3])), null);
        assert.strictEqual(read(new TextEncoder().encode("hello world")), null);
        assert.strictEqual(read(new Uint8Array(0)), null);
        assert.strictEqual(read("not bytes"), null);
        assert.strictEqual(read(null), null);
    });

    it("returns null for a bad meta", () => {
        const encoded = Codec.Encode({ meta: meta({ ttl: 999 }), payload: "x" });
        assert.strictEqual(read(encoded), null);

        const notObject = Codec.Encode({ meta: [1, 2], payload: "x" });
        assert.strictEqual(read(notObject), null);
    });

    it("returns null for a bad reserved payload", () => {
        const wrongShape = Message.Create({ type: SignalType.Join }, JSON.stringify({ nope: true }));
        assert.strictEqual(read(bytes(wrongShape)), null);

        const notJson = Message.Create({ type: SignalType.Join }, "{not json");
        assert.strictEqual(read(bytes(notJson)), null);

        const unknown = Message.Create({ type: "signal.nope" }, "{}");
        assert.strictEqual(read(bytes(unknown)), null);
    });
});
