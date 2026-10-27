import { describe, it } from "node:test";
import assert from "node:assert";

import { relay, BROADCAST } from "@papit/peer-message";

const meta = (over = {}) => ({
    id: "m1",
    type: "chat",
    sender: "a",
    receiver: "z",
    timestamp: 0,
    ttl: 4,
    hops: ["a"],
    ...over,
});

describe("relay", () => {

    it("drops a message it has already handled (loop)", () => {
        const m = meta({ hops: ["a", "me", "b"] });
        assert.strictEqual(relay(m, "me"), "drop");
        assert.deepStrictEqual(m.hops, ["a", "me", "b"]);
        assert.strictEqual(m.ttl, 4);
    });

    it("drops a message that comes back to its sender", () => {
        assert.strictEqual(relay(meta(), "a"), "drop");
    });

    it("delivers to the receiver and records the hop, ttl untouched", () => {
        const m = meta({ receiver: "me" });
        assert.strictEqual(relay(m, "me"), "deliver");
        assert.deepStrictEqual(m.hops, ["a", "me"]);
        assert.strictEqual(m.ttl, 4);
    });

    it("delivers even when ttl is already 0", () => {
        assert.strictEqual(relay(meta({ receiver: "me", ttl: 0 }), "me"), "deliver");
    });

    it("forwards a message for someone else and spends one ttl", () => {
        const m = meta();
        assert.strictEqual(relay(m, "me"), "forward");
        assert.deepStrictEqual(m.hops, ["a", "me"]);
        assert.strictEqual(m.ttl, 3);
    });

    it("drops a message for someone else when ttl runs out", () => {
        const m = meta({ ttl: 1 });
        assert.strictEqual(relay(m, "me"), "drop");
        assert.strictEqual(m.ttl, 0);
    });

    it("drops a message for someone else that arrives with ttl 0", () => {
        const m = meta({ ttl: 0 });
        assert.strictEqual(relay(m, "me"), "drop");
        assert.strictEqual(m.ttl, 0);
    });

    it("delivers and forwards a broadcast while ttl remains", () => {
        const m = meta({ receiver: BROADCAST, ttl: 2 });
        assert.strictEqual(relay(m, "me"), "both");
        assert.deepStrictEqual(m.hops, ["a", "me"]);
        assert.strictEqual(m.ttl, 1);
    });

    it("only delivers a broadcast once ttl runs out", () => {
        const m = meta({ receiver: BROADCAST, ttl: 1 });
        assert.strictEqual(relay(m, "me"), "deliver");
        assert.strictEqual(m.ttl, 0);
    });

    it("drops a looping broadcast", () => {
        assert.strictEqual(relay(meta({ receiver: BROADCAST, hops: ["a", "me"] }), "me"), "drop");
    });

    it("walks a chain until ttl is spent", () => {
        const m = meta({ ttl: 3 });
        const results = ["b", "c", "d", "e"].map(node => relay(m, node));
        assert.deepStrictEqual(results, ["forward", "forward", "drop", "drop"]);
    });
});
