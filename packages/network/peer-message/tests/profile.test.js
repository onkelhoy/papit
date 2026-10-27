import { describe, it } from "node:test";
import assert from "node:assert";

import { isProfile, isPayload, SignalType, NetworkType, MAX_PROFILE_BYTES } from "@papit/peer-message";

const network = { id: "n1", name: "lobby", host: "a", topology: "mesh", private: false, size: 2 };

describe("isProfile", () => {
    it("accepts JSON objects up to 1 KB", () => {
        assert.strictEqual(MAX_PROFILE_BYTES, 1024);
        assert.strictEqual(isProfile({}), true);
        assert.strictEqual(isProfile({ name: "Henry", color: "#f00", meta: { level: 3 } }), true);
        assert.strictEqual(isProfile({ name: "x".repeat(1024 - '{"name":""}'.length) }), true);
    });

    it("measures UTF-8 bytes, not characters", () => {
        // "å" is two bytes
        assert.strictEqual(isProfile({ name: "å".repeat(600) }), false);
    });

    it("rejects non-objects and oversized profiles", () => {
        for (const x of [null, undefined, "Henry", 1, [], true]) assert.strictEqual(isProfile(x), false, String(x));
        assert.strictEqual(isProfile({ name: "x".repeat(1024) }), false);
    });
});

describe("profiles in payloads", () => {
    it("signal.join and network.join take an optional profile", () => {
        assert.strictEqual(isPayload(SignalType.Join, { network: "n1", profile: { name: "a" } }), true);
        assert.strictEqual(isPayload(SignalType.Join, { network: "n1", profile: "a" }), false);
        assert.strictEqual(isPayload(NetworkType.Join, { profile: { name: "a" } }), true);
        assert.strictEqual(isPayload(NetworkType.Join, { profile: [] }), false);
    });

    it("network.welcome and network.members take an optional profiles map", () => {
        const profiles = { a: { name: "A" }, b: {} };
        assert.strictEqual(isPayload(NetworkType.Welcome, { network, members: ["a", "b"], connect: ["a"], profiles }), true);
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a", "b"], profiles }), true);
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a"], profiles: { a: "A" } }), false);
        assert.strictEqual(isPayload(NetworkType.Members, { members: ["a"], profiles: { ["x".repeat(65)]: {} } }), false);
        assert.strictEqual(isPayload(NetworkType.Welcome, { network, members: [], connect: [], profiles: [] }), false);
    });

    it("network.profile carries one profile", () => {
        assert.strictEqual(NetworkType.Profile, "network.profile");
        assert.strictEqual(isPayload(NetworkType.Profile, { profile: { name: "a" } }), true);
        assert.strictEqual(isPayload(NetworkType.Profile, {}), false);
        assert.strictEqual(isPayload(NetworkType.Profile, { profile: { name: "x".repeat(2000) } }), false);
    });
});
