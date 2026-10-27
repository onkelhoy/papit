import { describe, it } from "node:test";
import assert from "node:assert";

import {
    isMediaPlan,
    isPayload,
    read,
    Message,
    SignalType,
    NetworkType,
    HandshakeType,
    MAX_MEDIA_ENTRIES,
} from "@papit/peer-message";

const plan = {
    channels: {
        chat: { ordered: true, protocol: "json" },
        state: { ordered: false, maxRetransmits: 0 },
        live: { ordered: false, maxPacketLifeTime: 150 },
    },
    streams: {
        camera: { kind: "video" },
        mic: { kind: "audio" },
        screen: { kind: "video" },
    },
};

const network = {
    id: "n1",
    name: "lobby",
    host: "a",
    topology: "mesh",
    private: false,
    size: 2,
};

const many = (n, value) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`x${i}`, value]));

describe("isMediaPlan", () => {
    it("accepts a full plan, an empty plan and either half alone", () => {
        assert.strictEqual(isMediaPlan(plan), true);
        assert.strictEqual(isMediaPlan({}), true);
        assert.strictEqual(isMediaPlan({ channels: plan.channels }), true);
        assert.strictEqual(isMediaPlan({ streams: plan.streams }), true);
        assert.strictEqual(isMediaPlan({ channels: { a: {} }, streams: {} }), true);
    });

    it("accepts labels and names up to 64 characters", () => {
        const name = "x".repeat(64);
        assert.strictEqual(isMediaPlan({ channels: { [name]: {} }, streams: { [name]: { kind: "audio" } } }), true);
    });

    it(`accepts up to ${16} channels and streams`, () => {
        assert.strictEqual(MAX_MEDIA_ENTRIES, 16);
        assert.strictEqual(isMediaPlan({ channels: many(16, {}), streams: many(16, { kind: "video" }) }), true);
    });

    it("lets stream names start with _", () => {
        assert.strictEqual(isMediaPlan({ streams: { _hidden: { kind: "audio" } } }), true);
    });

    const bad = {
        "a non-object": null,
        "an array": [],
        "channels as an array": { channels: [] },
        "streams as an array": { streams: [] },
        "channels as a string": { channels: "chat" },
        "an empty channel label": { channels: { "": {} } },
        "a channel label over 64": { channels: { ["x".repeat(65)]: {} } },
        "a channel label starting with _": { channels: { _system: {} } },
        "a channel label of just _": { channels: { _: {} } },
        "17 channels": { channels: many(17, {}) },
        "a channel init that isn't an object": { channels: { chat: true } },
        "a null channel init": { channels: { chat: null } },
        "ordered not a boolean": { channels: { chat: { ordered: "yes" } } },
        "maxRetransmits negative": { channels: { chat: { maxRetransmits: -1 } } },
        "maxRetransmits fractional": { channels: { chat: { maxRetransmits: 1.5 } } },
        "maxRetransmits a string": { channels: { chat: { maxRetransmits: "3" } } },
        "maxPacketLifeTime negative": { channels: { chat: { maxPacketLifeTime: -5 } } },
        "maxPacketLifeTime NaN": { channels: { chat: { maxPacketLifeTime: NaN } } },
        "maxRetransmits and maxPacketLifeTime together": { channels: { chat: { maxRetransmits: 1, maxPacketLifeTime: 100 } } },
        "protocol not a string": { channels: { chat: { protocol: 1 } } },
        "a negotiated flag": { channels: { chat: { negotiated: true } } },
        "an id": { channels: { chat: { id: 3 } } },
        "an empty stream name": { streams: { "": { kind: "audio" } } },
        "a stream name over 64": { streams: { ["x".repeat(65)]: { kind: "audio" } } },
        "17 streams": { streams: many(17, { kind: "audio" }) },
        "a stream without kind": { streams: { camera: {} } },
        "a stream with a bad kind": { streams: { camera: { kind: "data" } } },
        "a stream that isn't an object": { streams: { camera: "video" } },
    };

    for (const [name, value] of Object.entries(bad))
    {
        it(`rejects ${name}`, () => {
            assert.strictEqual(isMediaPlan(value), false);
        });
    }
});

describe("media in payloads", () => {
    it("is optional on register and update, and checked when present", () => {
        assert.strictEqual(isPayload(SignalType.Register, { name: "lobby", topology: "mesh", media: plan }), true);
        assert.strictEqual(isPayload(SignalType.Register, { name: "lobby", topology: "mesh", media: { channels: { _x: {} } } }), false);
        assert.strictEqual(isPayload(SignalType.Update, { network: "n1", media: plan }), true);
        assert.strictEqual(isPayload(SignalType.Update, { network: "n1", media: { streams: { a: { kind: "x" } } } }), false);
    });

    it("is optional on NetworkInfo, and checked when present", () => {
        assert.strictEqual(isPayload(SignalType.Registered, { network: { ...network, media: plan } }), true);
        assert.strictEqual(isPayload(SignalType.Updated, { network: { ...network, media: plan } }), true);
        assert.strictEqual(isPayload(SignalType.Networks, { networks: [network, { ...network, media: plan }] }), true);
        assert.strictEqual(isPayload(NetworkType.Welcome, { network: { ...network, media: plan }, members: ["a"], connect: [] }), true);
        assert.strictEqual(isPayload(SignalType.Registered, { network: { ...network, media: [] } }), false);
        assert.strictEqual(isPayload(SignalType.Host, { network: { ...network, media: { channels: { _x: {} } } } }), false);
    });

    it("network.media carries a plan", () => {
        assert.strictEqual(NetworkType.Media, "network.media");
        assert.strictEqual(isPayload(NetworkType.Media, { media: plan }), true);
        assert.strictEqual(isPayload(NetworkType.Media, { media: {} }), true);
        assert.strictEqual(isPayload(NetworkType.Media, {}), false);
        assert.strictEqual(isPayload(NetworkType.Media, { media: { channels: { _system: {} } } }), false);
    });

    it("read() round-trips network.media and rejects a bad plan", () => {
        const good = Message.Create({ type: NetworkType.Media, sender: "a", receiver: "b" }, { media: plan });
        const message = read(good.toBinary());
        assert.ok(message);
        assert.deepStrictEqual(message.payload, { media: plan });

        const bad = Message.Create({ type: NetworkType.Media, sender: "a", receiver: "b" }, { media: { channels: { _x: {} } } });
        assert.strictEqual(read(bad.toBinary()), null);
    });
});

describe("handshake.offer stream map", () => {
    const description = { type: "offer", sdp: "v=0" };

    it("is optional, mid → stream name", () => {
        assert.strictEqual(isPayload(HandshakeType.Offer, { description }), true);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: {} }), true);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: { "0": "camera", "1": "mic" } }), true);
    });

    it("rejects a bad map", () => {
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: [] }), false);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: { "0": 1 } }), false);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: { "0": "" } }), false);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: { "0": "x".repeat(65) } }), false);
        assert.strictEqual(isPayload(HandshakeType.Offer, { description, streams: many(65, "camera") }), false);
    });
});
