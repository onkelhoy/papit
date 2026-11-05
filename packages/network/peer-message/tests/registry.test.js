import { describe, it } from "node:test";
import assert from "node:assert";

import { Registry, SignalType, NetworkType, SERVER } from "@papit/peer-message";

const make = (options) => new Registry({ id: (() => { let n = 0; return () => `n${++n}`; })(), hash: s => `#${s}`, ...options });
const types = (replies) => replies.map(r => r.message.meta.type);
const first = (replies, type) => replies.find(r => r.message.meta.type === type);
const payload = (reply) => JSON.parse(reply.message.payload);
const body = (reply) => typeof reply.message.payload === "string" ? JSON.parse(reply.message.payload) : reply.message.payload;
const reg = { name: "lobby", topology: "mesh" };

describe("register", () => {
    it("answers with the network, without a host", () => {
        const r = make();
        const out = r.register("a", reg);
        const { network } = body(first(out, SignalType.Registered));

        assert.deepStrictEqual(network, { id: "n1", name: "lobby", topology: "mesh", private: false, size: 1 });
        assert.strictEqual(first(out, SignalType.Registered).message.meta.sender, SERVER);
    });

    it("keeps anchors and the hashes out of the info", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 3, password: "pw", keyHash: "kh" });
        const [info] = r.list();

        assert.strictEqual(info.anchors, 3);
        assert.ok(!("passwordHash" in info) && !("keyHash" in info) && !("members" in info));
    });

    it("lists public networks only", () => {
        const r = make();
        r.register("a", reg);
        r.register("b", { ...reg, private: true });
        assert.strictEqual(r.list().length, 1);
    });
});

describe("update and unregister", () => {
    it("lets only an anchor change a network", () => {
        const r = make();
        r.register("a", reg);

        assert.strictEqual(body(first(r.update("b", { network: "n1", name: "x" }, "m1"), SignalType.Error)).code, "forbidden");
        const out = r.update("a", { network: "n1", name: "x" }, "m2");
        assert.strictEqual(body(first(out, SignalType.Updated)).network.name, "x");
        assert.strictEqual(body(first(r.update("a", { network: "nope" }, "m3"), SignalType.Error)).code, "not-found");
    });

    it("sets and clears a password", () => {
        const r = make();
        r.register("a", reg);
        r.update("a", { network: "n1", password: "pw" }, "m1");
        assert.strictEqual(body(first(r.join("b", { network: "n1" }, "m2"), SignalType.Error)).code, "forbidden");
        r.update("a", { network: "n1", password: "" }, "m3");
        assert.strictEqual(first(r.join("b", { network: "n1" }, "m4"), NetworkType.Join).to, "a");
    });

    it("unregisters", () => {
        const r = make();
        r.register("a", reg);
        assert.strictEqual(types(r.unregister("b", { network: "n1" }, "m")).join(), SignalType.Error);
        r.unregister("a", { network: "n1" }, "m");
        assert.strictEqual(r.networks.size, 0);
    });
});

describe("join", () => {
    it("forwards to the lowest anchor with the newcomer as sender, and counts it", () => {
        const r = make();
        r.register("a", reg);
        const out = r.join("b", { network: "n1", profile: { name: "b" } }, "m");

        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].to, "a");
        assert.strictEqual(out[0].message.meta.sender, "b");
        assert.strictEqual(r.list()[0].size, 2);
    });

    it("checks the password and the network", () => {
        const r = make();
        r.register("a", { ...reg, password: "pw" });
        assert.strictEqual(body(first(r.join("b", { network: "n1", password: "no" }, "m"), SignalType.Error)).code, "forbidden");
        assert.strictEqual(body(first(r.join("b", { network: "zz" }, "m"), SignalType.Error)).code, "not-found");
        assert.strictEqual(first(r.join("b", { network: "n1", password: "pw" }, "m"), NetworkType.Join).to, "a");
    });

    it("passes a merge on, and a matching keyHash heals without the password", () => {
        const r = make();
        r.register("a", { ...reg, password: "pw", keyHash: "k1" });
        const info = r.list()[0];
        const merge = { network: info, topology: "mesh", keyHash: "k1" };
        const out = first(r.join("x", { network: "n1", merge }, "m"), NetworkType.Join);
        assert.strictEqual(out.to, "a");
        assert.deepStrictEqual(out.message.parse().merge, merge);
        assert.strictEqual(r.list()[0].size, 1);
        assert.strictEqual(body(first(r.join("x", { network: "n1", merge: { ...merge, keyHash: "no" } }, "m"), SignalType.Error)).code, "forbidden");
    });

    it("uses pickEntry and answers unreachable for a gone entry", () => {
        const r = make({ pickEntry: (_, members) => members[members.length - 1], reachable: peer => peer !== "c" });
        r.register("a", reg);
        r.join("b", { network: "n1" }, "m");
        assert.strictEqual(first(r.join("c", { network: "n1" }, "m"), NetworkType.Join).to, "b");
        assert.strictEqual(types(r.join("d", { network: "n1" }, "m")).join(), SignalType.Unreachable);
        assert.strictEqual(r.list()[0].size, 3);
    });
});

describe("anchor", () => {
    const info = { id: "n1", name: "lobby", topology: "chord", private: false, size: 1, anchors: 2 };

    it("adds anchors up to the target and refuses the next", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2, keyHash: "k" });

        const ok = body(first(r.anchor("b", { network: info, keyHash: "k", peer: "b" }, "m"), SignalType.Anchored));
        assert.deepStrictEqual(ok, { network: "n1", ok: true, existed: true, entry: "a" });
        const full = body(first(r.anchor("c", { network: info, keyHash: "k", peer: "c" }, "m"), SignalType.Anchored));
        assert.deepStrictEqual(full, { network: "n1", ok: false, existed: true, entry: "a" });
    });

    it("tells every anchor the set on each change", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2, keyHash: "k" });
        const out = r.anchor("b", { network: info, keyHash: "k", peer: "b" }, "m");
        const sets = out.filter(x => x.message.meta.type === SignalType.Anchors);

        assert.deepStrictEqual(sets.map(x => x.to), ["a", "b"]);
        assert.deepStrictEqual(body(sets[0]), { network: "n1", anchors: ["a", "b"], target: 2 });
    });

    it("rejects a wrong key", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2, keyHash: "k" });
        assert.strictEqual(body(first(r.anchor("b", { network: info, keyHash: "no", peer: "b" }, "m"), SignalType.Error)).code, "forbidden");
    });

    it("re-creates a forgotten network under its id", () => {
        const r = make();
        const out = r.anchor("a", { network: info, keyHash: "k", peer: "p" }, "m");

        assert.deepStrictEqual(body(first(out, SignalType.Anchored)), { network: "n1", ok: true, existed: false });
        assert.deepStrictEqual(r.networks.get("n1").anchors, ["p"]);
        assert.strictEqual(r.networks.get("n1").target, 2);
    });

    it("answers ok for a peer that already anchors", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2, keyHash: "k" });
        const out = body(first(r.anchor("a", { network: info, keyHash: "k", peer: "a" }, "m"), SignalType.Anchored));
        assert.strictEqual(out.ok, true);
        assert.strictEqual(out.entry, undefined);
    });
});

describe("leave, unanchor and drop", () => {
    it("deletes the network with its last anchor, even with members left", () => {
        const r = make();
        r.register("a", reg);
        r.join("b", { network: "n1" }, "m");
        r.leave("a", "n1");
        assert.strictEqual(r.networks.size, 0);
    });

    it("keeps it while an anchor remains, and tells the rest", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2, keyHash: "k" });
        r.anchor("b", { network: { id: "n1", name: "l", topology: "mesh", private: false, size: 1 }, keyHash: "k", peer: "b" }, "m");
        const out = r.drop("a");

        assert.strictEqual(r.networks.size, 1);
        assert.deepStrictEqual(body(out[0]).anchors, ["b"]);
        assert.strictEqual(r.drop("b").length, 0);
        assert.strictEqual(r.networks.size, 0);
    });

    it("a plain member leaving changes the size only", () => {
        const r = make();
        r.register("a", reg);
        r.join("b", { network: "n1" }, "m");
        assert.strictEqual(r.leave("b", "n1").length, 0);
        assert.strictEqual(r.list()[0].size, 1);
    });

    it("unanchor removes the anchor, not the member", () => {
        const r = make();
        r.register("a", { ...reg, anchors: 2 });
        r.join("b", { network: "n1" }, "m");
        r.unanchor("b", { network: "n1" });
        assert.deepStrictEqual(r.networks.get("n1").anchors, ["a"]);
        r.unanchor("a", { network: "n1" });
        assert.strictEqual(r.networks.size, 0);
    });
});
