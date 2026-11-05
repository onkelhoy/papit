import { describe, it } from "node:test";
import assert from "node:assert";

import {
    isMeta,
    isPayload,
    isReserved,
    isKeyReceiver,
    SignalType,
    NetworkType,
    MAX_TOPOLOGY_PAYLOAD_BYTES,
    MAX_VIA,
    KEY_PREFIX,
    TOPOLOGY_PREFIX,
} from "@papit/peer-message";

const meta = (over = {}) => ({ id: "m1", type: "chat", sender: "a", receiver: "b", timestamp: 1, ttl: 4, hops: ["a"], ...over });
const info = { id: "n1", name: "lobby", topology: "chord", private: false, size: 2 };

describe("meta hint and via", () => {
    it("accepts a hint and waypoints", () => {
        assert.strictEqual(isMeta(meta({ hint: "x".repeat(64) })), true);
        assert.strictEqual(isMeta(meta({ via: Array(MAX_VIA).fill("v") })), true);
    });

    it("rejects a bad hint or too many waypoints", () => {
        assert.strictEqual(isMeta(meta({ hint: "x".repeat(65) })), false);
        assert.strictEqual(isMeta(meta({ hint: 1 })), false);
        assert.strictEqual(isMeta(meta({ via: Array(MAX_VIA + 1).fill("v") })), false);
        assert.strictEqual(isMeta(meta({ via: ["a", 2] })), false);
        assert.strictEqual(isMeta(meta({ via: "a" })), false);
    });
});

describe("topology.* messages", () => {
    it("is reserved", () => {
        assert.strictEqual(TOPOLOGY_PREFIX, "topology.");
        assert.strictEqual(isReserved("topology.x"), true);
        assert.strictEqual(isReserved("topologyx"), false);
    });

    it("takes any JSON that fits", () => {
        assert.strictEqual(isPayload("topology.chord", { a: [1, 2] }), true);
        assert.strictEqual(isPayload("topology.chord", {}), true);
    });

    it("rejects a payload over the limit", () => {
        const pad = "x".repeat(MAX_TOPOLOGY_PAYLOAD_BYTES);
        assert.strictEqual(isPayload("topology.chord", { pad }), false);
    });
});

describe("isKeyReceiver", () => {
    it("accepts the prefix and a hex hash", () => {
        assert.strictEqual(KEY_PREFIX, "@");
        assert.strictEqual(isKeyReceiver("@" + "ab12".repeat(15)), true);
    });

    it("rejects the rest", () => {
        for (const x of ["@", "ab12", "@xyz", "@" + "a".repeat(64), 1, null, ""]) assert.strictEqual(isKeyReceiver(x), false, String(x));
    });
});

describe("network types for the engine", () => {
    const valid = {
        [NetworkType.Admit]: { network: info, key: "k", merge: false },
        [NetworkType.Adopt]: { network: info, key: "k" },
        [NetworkType.Anchor]: {},
        [NetworkType.Beacon]: { anchors: 3 },
        [NetworkType.Ping]: { n: 1 },
        [NetworkType.Pong]: { n: 1 },
        [NetworkType.Join]: { merge: { network: info, topology: { name: "chord" }, keyHash: "ab" } },
    };
    const invalid = {
        [NetworkType.Admit]: { network: info, key: "k" },
        [NetworkType.Adopt]: { network: info },
        [NetworkType.Beacon]: { anchors: -1 },
        [NetworkType.Ping]: { n: "1" },
        [NetworkType.Pong]: {},
    };

    for (const [type, payload] of Object.entries(valid))
    {
        it(`accepts ${type}`, () => assert.strictEqual(isPayload(type, payload), true));
    }
    for (const [type, payload] of Object.entries(invalid))
    {
        it(`rejects a bad ${type}`, () => assert.strictEqual(isPayload(type, payload), false));
    }

    it("rejects a bad merge on join", () => {
        assert.strictEqual(isPayload(NetworkType.Join, { merge: { network: info } }), false);
        assert.strictEqual(isPayload(NetworkType.Join, { merge: { network: info, topology: "mesh", keyHash: 1 } }), false);
    });
});

describe("network info additions", () => {
    it("takes anchors, beacon and entries, and no host", () => {
        const full = { ...info, anchors: 3, beacon: 0, entries: ["a", "b"] };
        assert.strictEqual(isPayload(SignalType.Registered, { network: full }), true);
    });

    it("rejects bad values", () => {
        for (const over of [{ anchors: 0 }, { beacon: -1 }, { entries: [1] }])
        {
            assert.strictEqual(isPayload(SignalType.Registered, { network: { ...info, ...over } }), false, JSON.stringify(over));
        }
    });
});

describe("signal types for anchors", () => {
    const valid = {
        [SignalType.Anchor]: { network: info, keyHash: "ab", peer: "p" },
        [SignalType.Anchored]: { network: "n1", ok: true, existed: true, entry: "p" },
        [SignalType.Unanchor]: { network: "n1" },
        [SignalType.Anchors]: { network: "n1", anchors: ["a", "b"], target: 3 },
        [SignalType.Register]: { name: "l", topology: "chord", anchors: 3, keyHash: "ab" },
    };
    const invalid = {
        [SignalType.Anchor]: { network: info, peer: "p" },
        [SignalType.Anchored]: { network: "n1", ok: true },
        [SignalType.Unanchor]: {},
        [SignalType.Anchors]: { network: "n1", anchors: "a", target: 3 },
        [SignalType.Register]: { name: "l", topology: "chord", anchors: 0 },
    };

    for (const [type, payload] of Object.entries(valid))
    {
        it(`accepts ${type}`, () => assert.strictEqual(isPayload(type, payload), true));
    }
    for (const [type, payload] of Object.entries(invalid))
    {
        it(`rejects a bad ${type}`, () => assert.strictEqual(isPayload(type, payload), false));
    }
});
