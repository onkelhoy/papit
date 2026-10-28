import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/network/');
  await page.waitForFunction(() => (window as any).ready === true);
});

test.describe("mesh", () => {
  test("delivers a to f directly in one hop", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log } = w.build("mesh", 6);

      const delivered = w.once(nodes.f, "message");
      const sent = nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: "f" }, { text: "hej" }));
      const event = await delivered;
      await w.settle();

      return {
        sent,
        hops: event.detail.meta.hops,
        text: event.detail.parse().text,
        counts: Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length])),
      };
    });

    expect(result.sent).toBe(true);
    expect(result.hops).toEqual(["a", "f"]);
    expect(result.text).toBe("hej");
    expect(result.counts).toEqual({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 1 });
  });

  test("broadcast reaches every other node exactly once", async ({ page }) => {
    const counts = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log, members } = w.build("mesh", 6);

      const all = members.filter((id: string) => id !== "a").map((id: string) => w.once(nodes[id], "message"));
      nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: w.BROADCAST }, {}));
      await Promise.all(all);
      await w.settle();

      return Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length]));
    });

    expect(counts).toEqual({ a: 0, b: 1, c: 1, d: 1, e: 1, f: 1 });
  });
});

test.describe("star", () => {
  test("routes leaf to leaf via the hub", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log } = w.build("star", 6, "a");

      const delivered = w.once(nodes.c, "message");
      nodes.b.send(w.Message.Create({ type: "chat", sender: "b", receiver: "c" }, {}));
      const event = await delivered;
      await w.settle();

      return {
        hops: event.detail.meta.hops,
        counts: Object.fromEntries(Object.entries(log).map(([id, l]: any) => [id, l.message.length])),
      };
    });

    expect(result.hops).toEqual(["b", "a", "c"]);
    expect(result.counts).toEqual({ a: 0, b: 0, c: 1, d: 0, e: 0, f: 0 });
  });
});

test.describe("chord", () => {
  test("delivers a to every unlinked node of 16 in at most 6 hops", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, members } = w.build("chord", 16);
      const far = members.filter((id: string) => id !== "a" && !nodes.a.view.links.includes(id));

      const hops: Record<string, string[]> = {};
      for (const id of far)
      {
        const delivered = w.once(nodes[id], "message");
        nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: id }, {}));
        hops[id] = (await delivered).detail.meta.hops;
      }

      return { far: far.length, hops };
    });

    expect(result.far).toBeGreaterThan(0);
    for (const [id, hops] of Object.entries(result.hops))
    {
      expect(hops[0]).toBe("a");
      expect(hops[hops.length - 1]).toBe(id);
      expect(hops.length).toBeLessThanOrEqual(6);
    }
  });

  test("broadcast reaches every other node of 16 exactly once", async ({ page }) => {
    const counts = await page.evaluate(async () => {
      const w = window as any;
      const { nodes, log, members } = w.build("chord", 16);

      const all = members.filter((id: string) => id !== "a").map((id: string) => w.once(nodes[id], "message"));
      nodes.a.send(w.Message.Create({ type: "chat", sender: "a", receiver: w.BROADCAST }, {}));
      await Promise.all(all);
      await w.settle();

      return Object.values(log).map((l: any) => l.message.length);
    });

    expect(counts).toEqual([0, ...Array(15).fill(1)]);
  });
});

test.describe("multicast", () => {
  // pure logic against hand-built views, no links opened
  test("shape: host's neighbours are its children, a leaf has only its parent", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      const m = w.multicast;
      const members = Array.from({ length: 13 }, (_, i) => String.fromCharCode(97 + i));
      const v = (me: string, list: string[]) => ({ me, host: list[0], members: list, links: [] });
      return {
        name: m.name,
        one: m.neighbors(v("a", ["a"]), "a"),
        twoHost: m.neighbors(v("a", ["a", "b"]), "a"),
        twoLeaf: m.neighbors(v("b", ["a", "b"]), "b"),
        host: m.neighbors(v("a", members), "a"),
        b: m.neighbors(v("b", members), "b"),
        d: m.neighbors(v("d", members), "d"),
        leaf: m.neighbors(v("m", members), "m"),
        stranger: m.neighbors(v("a", members), "z"),
        hostless: m.neighbors({ me: "a", host: "z", members, links: [] }, "a"),
      };
    });

    expect(result.name).toBe("multicast");
    expect(result.one).toEqual([]);
    expect(result.twoHost).toEqual(["b"]);
    expect(result.twoLeaf).toEqual(["a"]);
    expect(result.host).toEqual(["b", "c", "d"]);
    expect(result.b).toEqual(["a", "e", "f", "g"]);
    expect(result.d).toEqual(["a", "k", "l", "m"]);
    expect(result.leaf).toEqual(["d"]);
    expect(result.stranger).toEqual([]);
    expect(result.hostless).toEqual([]);
  });

  test("host is the root even when it doesn't sort first", async ({ page }) => {
    const result = await page.evaluate(() => {
      const m = (window as any).multicast;
      const members = ["a", "b", "c", "d", "e"];
      const v = { me: "c", host: "c", members, links: [] };
      return { root: m.neighbors(v, "c"), a: m.neighbors(v, "a"), e: m.neighbors(v, "e") };
    });

    // order: c, a, b, d, e
    expect(result.root).toEqual(["a", "b", "d"]);
    expect(result.a).toEqual(["c", "e"]);
    expect(result.e).toEqual(["a"]);
  });

  test("custom fanout of 2 builds a binary tree", async ({ page }) => {
    const result = await page.evaluate(() => {
      const m = (window as any).multicastTopology({ fanout: 2 });
      const members = ["a", "b", "c", "d", "e", "f", "g"];
      const v = { me: "a", host: "a", members, links: [] };
      return { name: m.name, a: m.neighbors(v, "a"), b: m.neighbors(v, "b"), c: m.neighbors(v, "c"), g: m.neighbors(v, "g") };
    });

    expect(result.name).toBe("multicast");
    expect(result.a).toEqual(["b", "c"]);
    expect(result.b).toEqual(["a", "d", "e"]);
    expect(result.c).toEqual(["a", "f", "g"]);
    expect(result.g).toEqual(["c"]);
  });

  test("neighbours are symmetric", async ({ page }) => {
    const broken = await page.evaluate(() => {
      const w = window as any;
      const out: string[] = [];
      for (const topology of [w.multicast, w.multicastTopology({ fanout: 1 }), w.multicastTopology({ fanout: 5 })])
      {
        const members = Array.from({ length: 23 }, (_, i) => String.fromCharCode(97 + i));
        const v = { me: "a", host: "h", members, links: [] };
        for (const a of members)
        {
          for (const b of topology.neighbors(v, a))
          {
            if (!topology.neighbors(v, b).includes(a)) out.push(`${a}->${b}`);
          }
        }
      }
      return out;
    });

    expect(broken).toEqual([]);
  });

  test("broadcast through the whole tree reaches every member exactly once", async ({ page }) => {
    const counts = await page.evaluate(() => {
      const m = (window as any).multicast;
      const members = Array.from({ length: 20 }, (_, i) => String.fromCharCode(97 + i));
      const host = "f";
      const view = (me: string) => ({ me, host, members, links: m.neighbors({ me, host, members, links: [] }, me) });

      const counts: Record<string, number> = Object.fromEntries(members.map(id => [id, 0]));
      const queue = [{ at: "k", hops: ["k"] }];
      counts.k = 1;
      while (queue.length)
      {
        const { at, hops } = queue.shift()!;
        const meta = { receiver: "*", hops, sender: "k", ttl: 99 };
        for (const next of m.route(view(at), meta))
        {
          counts[next]++;
          queue.push({ at: next, hops: [...hops, next] });
        }
      }
      return counts;
    });

    expect(Object.values(counts)).toEqual(Array(20).fill(1));
  });

  test("unicast goes down into the receiver's subtree, else up to the parent", async ({ page }) => {
    const result = await page.evaluate(() => {
      const m = (window as any).multicast;
      const members = Array.from({ length: 13 }, (_, i) => String.fromCharCode(97 + i));
      const view = (me: string, links?: string[]) => ({ me, host: "a", members, links: links ?? m.neighbors({ me, host: "a", members, links: [] }, me) });
      const meta = (receiver: string) => ({ receiver, hops: [], sender: "x", ttl: 9 });
      return {
        // b's children are e, f, g; e has no children with 13 members
        rootDown: m.route(view("a"), meta("f")),
        direct: m.route(view("a"), meta("c")),
        directShortcut: m.route(view("e", ["b", "m"]), meta("m")),
        up: m.route(view("e"), meta("m")),
        sibling: m.route(view("b"), meta("c")),
        noLinks: m.route(view("b", []), meta("m")),
        unknown: m.route(view("b"), meta("z")),
        unknownAtRoot: m.route(view("a"), meta("z")),
      };
    });

    expect(result.rootDown).toEqual(["b"]);
    expect(result.direct).toEqual(["c"]);
    expect(result.directShortcut).toEqual(["m"]);
    expect(result.up).toEqual(["b"]);
    expect(result.sibling).toEqual(["a"]);
    expect(result.noLinks).toEqual([]);
    expect(result.unknown).toEqual(["a"]);
    expect(result.unknownAtRoot).toEqual([]);
  });

  test("media streams flow only toward children; relay is the parent", async ({ page }) => {
    const result = await page.evaluate(() => {
      const m = (window as any).multicast;
      const members = ["a", "b", "c", "d", "e", "f"];
      const v = (me: string) => ({ me, host: "a", members, links: [] });
      const plan = { channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } };
      return {
        toChild: m.media(v("b"), "e", plan),
        toParent: m.media(v("b"), "a", plan),
        toStranger: m.media(v("b"), "c", plan),
        relayLeaf: m.relay(v("e"), "cam"),
        relayRoot: m.relay(v("a"), "cam"),
      };
    });

    expect(result.toChild).toEqual({ channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } });
    expect(result.toParent).toEqual({ channels: { chat: { ordered: true } }, streams: {} });
    expect(result.toStranger).toEqual({ channels: { chat: { ordered: true } }, streams: {} });
    expect(result.relayLeaf).toBe("b");
    expect(result.relayRoot).toBeNull();
  });

  test("invalid fanout throws a RangeError", async ({ page }) => {
    const errors = await page.evaluate(() => {
      const w = window as any;
      return [0, -1, 1.5, NaN, Infinity].map(fanout => {
        try { w.multicastTopology({ fanout }); return "ok"; }
        catch (e) { return (e as Error).name; }
      });
    });

    expect(errors).toEqual(Array(5).fill("RangeError"));
  });
});

test.describe("topology config", () => {
  test("a config resolves with its options", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      // the host's children in a 6-member tree: as many as the fanout allows
      const view = { me: "a", host: "a", members: ["a", "b", "c", "d", "e", "f"], links: [] };
      const five = w.resolveTopology({ name: "multicast", fanout: 5 });
      const plain = w.resolveTopology({ name: "multicast" });
      return { name: five.name, five: five.neighbors(view, "a").length, plain: plain.neighbors(view, "a").length };
    });

    expect(result).toEqual({ name: "multicast", five: 5, plain: 3 });
  });

  test("a name resolves to the built-in", async ({ page }) => {
    const names = await page.evaluate(() => {
      const w = window as any;
      return ["mesh", "star", "chord", "multicast"].map(name => w.resolveTopology(name).name);
    });

    expect(names).toEqual(["mesh", "star", "chord", "multicast"]);
  });

  test("a registered custom topology resolves with its config", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      w.registerTopology("ring", (config: any) => ({ ...w.resolveTopology("mesh"), name: "ring", size: config.size }));
      const errors: unknown[] = [];
      const ring = w.resolveTopology({ name: "ring", size: 4 }, (error: unknown) => errors.push(error));
      return { name: ring.name, size: ring.size, errors: errors.length };
    });

    expect(result).toEqual({ name: "ring", size: 4, errors: 0 });
  });

  test("an unknown name falls back to mesh and reports it", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      const errors: string[] = [];
      const topology = w.resolveTopology({ name: "nope" }, (error: Error) => errors.push(error.message));
      const silent = w.resolveTopology("nope");
      return { name: topology.name, silent: silent.name, errors: errors.length };
    });

    expect(result).toEqual({ name: "mesh", silent: "mesh", errors: 1 });
  });

  test("a config the factory rejects falls back to mesh and reports it", async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = window as any;
      const errors: string[] = [];
      const names = [-1, 1.5, "5"].map(fanout => w.resolveTopology({ name: "multicast", fanout }, (error: Error) => errors.push(error.name)).name);
      return { names, errors };
    });

    expect(result.names).toEqual(["mesh", "mesh", "mesh"]);
    expect(result.errors).toEqual(["RangeError", "RangeError", "RangeError"]);
  });

  test("registering a built-in name throws", async ({ page }) => {
    const errors = await page.evaluate(() => {
      const w = window as any;
      return ["mesh", "star", "chord", "multicast"].map(name => {
        try { w.registerTopology(name, () => w.resolveTopology("mesh")); return "ok"; }
        catch (e) { return (e as Error).name; }
      });
    });

    expect(errors).toEqual(Array(4).fill("RangeError"));
  });
});
