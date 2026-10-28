import { describe, it } from "node:test";
import assert from "node:assert";

import { isTopology, isPayload, SignalType, NetworkType, MAX_TOPOLOGY_BYTES } from "@papit/peer-message";

const network = (topology) => ({ id: "n1", name: "lobby", host: "a", topology, private: false, size: 2 });

describe("isTopology", () => {
    it("accepts an id-shaped name", () => {
        assert.strictEqual(isTopology("mesh"), true);
        assert.strictEqual(isTopology("x".repeat(64)), true);
    });

    it("accepts a JSON config with an id-shaped name", () => {
        assert.strictEqual(isTopology({ name: "multicast" }), true);
        assert.strictEqual(isTopology({ name: "multicast", fanout: 5, nested: { a: [1, 2] } }), true);
    });

    it("rejects an empty, missing or oversized name", () => {
        assert.strictEqual(isTopology(""), false);
        assert.strictEqual(isTopology("x".repeat(65)), false);
        assert.strictEqual(isTopology({}), false);
        assert.strictEqual(isTopology({ name: "" }), false);
        assert.strictEqual(isTopology({ name: 3 }), false);
        assert.strictEqual(isTopology({ name: "x".repeat(65) }), false);
    });

    it("rejects a config over MAX_TOPOLOGY_BYTES UTF-8 bytes", () => {
        assert.strictEqual(MAX_TOPOLOGY_BYTES, 1024);
        assert.strictEqual(isTopology({ name: "a", pad: "x".repeat(1024) }), false);
        // "å" is two bytes
        assert.strictEqual(isTopology({ name: "a", pad: "å".repeat(510) }), false);
    });

    it("rejects non-strings and non-objects", () => {
        for (const x of [null, undefined, 1, true, [], ["mesh"]]) assert.strictEqual(isTopology(x), false, String(x));
    });
});

describe("topology in payloads", () => {
    it("signal.register takes a name or a config", () => {
        assert.strictEqual(isPayload(SignalType.Register, { name: "lobby", topology: "mesh" }), true);
        assert.strictEqual(isPayload(SignalType.Register, { name: "lobby", topology: { name: "multicast", fanout: 5 } }), true);
        assert.strictEqual(isPayload(SignalType.Register, { name: "lobby", topology: { fanout: 5 } }), false);
    });

    it("network info carries a name or a config", () => {
        const welcome = (topology) => ({ network: network(topology), members: ["a"], connect: [] });
        assert.strictEqual(isPayload(NetworkType.Welcome, welcome("mesh")), true);
        assert.strictEqual(isPayload(NetworkType.Welcome, welcome({ name: "multicast", fanout: 5 })), true);
        assert.strictEqual(isPayload(NetworkType.Welcome, welcome(5)), false);
    });
});
