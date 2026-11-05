import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('tests/core/');
  await page.waitForFunction(() => (window as any).ready === true);
});

test.describe("engine", () => {
  test("a newcomer joins and messages go both ways", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes } = await w.build(["a", "b"]);

      nodes.a.send("b", "chat", { text: "hej" });
      nodes.b.send("a", "chat", { text: "hallå" });
      await w.flush();

      return {
        links: [world.links("a"), world.links("b")],
        a: nodes.a.log.map((m: any) => m.data.text),
        b: nodes.b.log.map((m: any) => m.data.text),
      };
    });

    expect(result.links).toEqual([["b"], ["a"]]);
    expect(result.a).toEqual(["hallå"]);
    expect(result.b).toEqual(["hej"]);
  });

  test("a via hop out and a back-path reply home, without the server", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      // b and c both enter through a, so b and c share no link
      const { world, nodes } = await w.build(["a", "b", "c"]);
      const carried = world.server.carried;

      nodes.b.topology.ctx.send("c", "ping", { n: 1 }, { via: ["a"] });
      await w.flush();

      return {
        links: world.links("b"),
        c: nodes.c.topology.log,
        b: nodes.b.topology.log,
        carried: world.server.carried - carried,
      };
    });

    expect(result.links).toEqual(["a"]);
    expect(result.c).toEqual([{ from: "b", type: "ping", payload: { n: 1 } }]);
    expect(result.b).toEqual([{ from: "c", type: "pong", payload: { n: 1 } }]);
    expect(result.carried).toBe(0);
  });

  test("joining a network nobody registered rejects", async ({ page }) => {
    const message = await page.evaluate(async () => {
      const w = window as any;
      const world = w.createWorld();
      return world.node("a").join("nope").catch((error: Error) => error.message);
    });

    expect(message).toBe("no such network");
  });

  test("a link closes only once neither side wants it", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes } = await w.build(["a", "b", "c"]);

      // b wants a, a doesn't want b: b's prune closes it
      nodes.b.topology.ctx.disconnect("a");
      await w.flush();
      const afterB = world.links("a");

      // both want a–c: the first prune is ignored, the second closes it
      nodes.a.topology.ctx.connect("c");
      nodes.c.topology.ctx.disconnect("a");
      await w.flush();
      const afterFirst = world.links("a");
      nodes.a.topology.ctx.disconnect("c");
      await w.flush();

      return { afterB, afterFirst, end: [world.links("a"), world.links("c")] };
    });

    expect(result.afterB).toEqual(["c"]);
    expect(result.afterFirst).toEqual(["c"]);
    expect(result.end).toEqual([[], []]);
  });

  test("two sides connecting at once end with one link", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes } = await w.build(["a", "b", "c"]);

      nodes.b.topology.ctx.connect("c");
      nodes.c.topology.ctx.connect("b");
      await w.flush();

      return { b: world.links("b"), c: world.links("c"), paired: world.paired("b", "c") };
    });

    expect(result.b).toEqual(["a", "c"]);
    expect(result.c).toEqual(["a", "b"]);
    expect(result.paired).toBe(1);
  });

  test("rtt answers over a link and rejects without one", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes } = await w.build(["a", "b", "c"]);

      const rtt = await nodes.b.topology.ctx.rtt("a");
      const missing = await nodes.b.topology.ctx.rtt("c").catch((error: Error) => error.message);
      return { rtt, missing };
    });

    expect(result.rtt).toBe(0);
    expect(result.missing).toBe("not linked to c");
  });

  test("close sends leave and leaves no timers", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes } = await w.build(["a", "b", "c"]);
      const left: any[] = [];
      nodes.a.on("link", (event: any) => left.push(event.detail));

      nodes.b.close();
      await w.flush();
      const timers = world.pending("b");
      nodes.a.close();
      nodes.c.close();
      await w.flush();

      return { left, timers, all: world.pending() };
    });

    expect(result.left).toEqual([{ peer: "b", open: false, left: true }]);
    expect(result.timers).toBe(0);
    expect(result.all).toBe(0);
  });
});

test.describe("socket bootstrap", () => {
  test("creates, anchors and unanchors through signal messages", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const socket = w.fakeSocket("s1");
      const bootstrap = new w.core.SocketBootstrap(socket);

      const info = await bootstrap.create({ name: "lobby", topology: "tiny", anchors: 2, beacon: 5000 }, "hash");
      const again = await bootstrap.anchor(info, "hash");
      const wrong = await bootstrap.anchor(info, "other").catch((error: Error) => error.message);
      bootstrap.unanchor(info.id);

      return { name: info.name, beacon: info.beacon, host: "host" in info, again, wrong, sent: socket.sent };
    });

    expect(result).toMatchObject({ name: "lobby", beacon: 5000, host: false, again: { ok: true, existed: true }, wrong: "wrong key" });
    expect(result.sent).toEqual(["signal.register", "signal.anchor", "signal.anchor", "signal.unanchor"]);
  });

  test("a join the server can't deliver reaches the network as a reject", async ({ page }) => {
    const message = await page.evaluate(async () => {
      const w = window as any;
      const bootstrap = new w.core.SocketBootstrap(w.fakeSocket("s2"));
      const network = new w.core.Network({ me: "s2", bootstrap, connector: new w.core.MemoryConnector({ pair: () => null }) });
      return network.join("nope").catch((error: Error) => error.message);
    });

    expect(message).toBe("no such network");
  });

  test("refuses a socket that has no id yet", async ({ page }) => {
    const message = await page.evaluate(() => {
      const w = window as any;
      try { new w.core.SocketBootstrap(Object.assign(new EventTarget(), { me: null })); return "no error"; }
      catch (error: any) { return error.message; }
    });

    expect(message).toMatch(/no id yet/);
  });
});

test.describe("anchors", () => {
  test("fill to the target, and a killed anchor is replaced", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes, info } = await w.build(["a", "b", "c", "d", "e", "f"], { anchors: 3 });
      // the Client answers by opening a socket; here every node already has one
      for (const node of Object.values(nodes) as any[]) node.on("anchor-request", () => node.anchor());

      const anchors = () => world.server.registry.networks.get(info.id)?.anchors ?? [];
      await w.until(world, () => anchors().length === 3);
      const before = [...anchors()];

      const victim = before.find((id: string) => id !== "a");
      world.kill(victim);
      const took = await w.until(world, () => anchors().length === 3 && !anchors().includes(victim));

      const flags = Object.fromEntries(Object.entries(nodes).map(([id, node]: any) => [id, node.anchored]));
      return { before, after: [...anchors()], victim, took, flags };
    });

    expect(result.before).toHaveLength(3);
    expect(result.took).toBeGreaterThanOrEqual(0);
    expect(result.took).toBeLessThanOrEqual(2000);
    expect(result.after).toHaveLength(3);
    expect(result.after).not.toContain(result.victim);
    for (const id of result.after) expect(result.flags[id]).toBe(true);
  });

  test("a closed anchor frees its slot", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes, info } = await w.build(["a", "b", "c"], { anchors: 2 });
      const anchors = () => world.server.registry.networks.get(info.id)?.anchors ?? [];
      await w.until(world, () => anchors().length === 2);
      const before = [...anchors()];
      nodes[before[1]].close();
      await w.flush();
      return { before, after: [...anchors()] };
    });

    expect(result.before).toEqual(["a", "b"]);
    expect(result.after).toEqual(["a"]);
  });
});

test.describe("mesh", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];

  test("six join one after another and everyone links to everyone", async ({ page }) => {
    const links = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world } = await w.build(ids, { topology: "mesh" });
      await w.until(world, () => ids.every((id: string) => world.links(id).length === 5));
      return Object.fromEntries(ids.map((id: string) => [id, world.links(id)]));
    }, ids);

    for (const id of ids) expect(links[id]).toEqual(ids.filter(other => other !== id));
  });

  test("a killed node leaves everyone knowing four", async ({ page }) => {
    const known = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "mesh" });
      await w.until(world, () => ids.every((id: string) => world.links(id).length === 5));
      world.kill("c");
      const alive = ids.filter((id: string) => id !== "c");
      await w.until(world, () => alive.every((id: string) => nodes[id].known().length === 4));
      return alive.map((id: string) => nodes[id].known().length);
    }, ids);

    expect(known).toEqual([4, 4, 4, 4, 4]);
  });

  test("a broadcast reaches each node once", async ({ page }) => {
    const counts = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "mesh" });
      await w.until(world, () => ids.every((id: string) => world.links(id).length === 5));
      nodes.d.broadcast("chat", { text: "hej" });
      await w.flush();
      return ids.map((id: string) => nodes[id].log.length);
    }, ids);

    expect(counts).toEqual([1, 1, 1, 0, 1, 1]);
  });

  test("sendKey lands on the same owner from everywhere", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "mesh" });
      await w.until(world, () => ids.every((id: string) => world.links(id).length === 5));
      for (const id of ids) nodes[id].sendKey("room-42", "put", { from: id });
      await w.flush();
      const owners = await Promise.all(ids.map((id: string) => nodes[id].node.owner("room-42")));
      return { owners, got: ids.map((id: string) => nodes[id].log.length) };
    }, ids);

    const owner = result.owners[0];
    expect(new Set(result.owners).size).toBe(1);
    // the owner's own sendKey is delivered to itself
    expect(result.got).toEqual(ids.map(id => id === owner ? 6 : 0));
  });
});

test.describe("star", () => {
  const ids = ["a", "b", "c", "d", "e"];

  test("five join and everyone has the same members", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "star" });
      await w.until(world, () => ids.every((id: string) => nodes[id].topology.members.length === 5));
      return ids.map((id: string) => ({ hub: nodes[id].topology.hub, members: [...nodes[id].topology.members].sort() }));
    }, ids);

    for (const node of result) expect(node).toEqual({ hub: "a", members: ids });
  });

  test("the standby takes over when the hub dies", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "star" });
      await w.until(world, () => ids.every((id: string) => nodes[id].topology.members.length === 5));
      world.kill("a");
      const alive = ids.slice(1);
      await w.until(world, () => alive.every((id: string) => nodes[id].topology.hub === "b" && nodes[id].topology.members.length === 4));
      nodes.e.broadcast("chat", { text: "hej" });
      await w.flush();
      return {
        hubs: alive.map((id: string) => nodes[id].topology.hub),
        members: alive.map((id: string) => nodes[id].topology.members.length),
        got: alive.map((id: string) => nodes[id].log.length),
      };
    }, ids);

    expect(result.hubs).toEqual(["b", "b", "b", "b"]);
    expect(result.members).toEqual([4, 4, 4, 4]);
    expect(result.got).toEqual([1, 1, 1, 0]);
  });
});

test.describe("multicast", () => {
  const ids = "abcdefghijklm".split("");
  const draft = { topology: { name: "multicast", fanout: 3 } };

  /** Depth of every node by walking parents, -1 when the chain breaks or loops. */
  const depths = (nodes: any, alive: string[]) => alive.map(id => {
    let depth = 0;
    for (let at = id; nodes[at].topology.parent; depth++)
    {
      at = nodes[at].topology.parent;
      if (!alive.includes(at) || depth > alive.length) return -1;
    }
    return depth;
  });

  test("thirteen nodes with fanout 3 form a tree of depth 2", async ({ page }) => {
    const result = await page.evaluate(async ({ ids, draft, depths }) => {
      const w = window as any;
      const depthOf = new Function(`return ${depths}`)();
      const { world, nodes } = await w.build(ids, draft);
      await world.run(500);
      return {
        depths: depthOf(nodes, ids),
        roots: ids.map((id: string) => nodes[id].topology.root),
        fanout: Math.max(...ids.map((id: string) => nodes[id].topology.children.length)),
      };
    }, { ids, draft, depths: depths.toString() });

    expect(Math.max(...result.depths)).toBe(2);
    expect(result.depths.filter((d: number) => d === 0)).toHaveLength(1);
    expect(new Set(result.roots)).toEqual(new Set(["a"]));
    expect(result.fanout).toBe(3);
  });

  test("the children of a killed inner node reattach", async ({ page }) => {
    const result = await page.evaluate(async ({ ids, draft, depths }) => {
      const w = window as any;
      const depthOf = new Function(`return ${depths}`)();
      const { world, nodes } = await w.build(ids, draft);
      await world.run(500);
      world.kill("b");
      const alive = ids.filter((id: string) => id !== "b");
      await w.until(world, () => depthOf(nodes, alive).every((d: number) => d >= 0));
      nodes.a.broadcast("chat", { text: "hej" });
      await w.flush();
      return { depths: depthOf(nodes, alive), got: alive.map((id: string) => nodes[id].log.length) };
    }, { ids, draft, depths: depths.toString() });

    expect(result.depths.every((d: number) => d >= 0)).toBe(true);
    expect(result.got).toEqual([0, ...Array(11).fill(1)]);
  });

  test("a killed root leaves one root again", async ({ page }) => {
    const result = await page.evaluate(async ({ ids, draft, depths }) => {
      const w = window as any;
      const depthOf = new Function(`return ${depths}`)();
      const { world, nodes } = await w.build(ids, draft);
      await world.run(500);
      world.kill("a");
      const alive = ids.slice(1);
      await w.until(world, () => alive.every((id: string) => nodes[id].topology.root === "b") && depthOf(nodes, alive).every((d: number) => d >= 0));
      return { roots: alive.map((id: string) => nodes[id].topology.root), depths: depthOf(nodes, alive) };
    }, { ids, draft, depths: depths.toString() });

    expect(new Set(result.roots)).toEqual(new Set(["b"]));
    expect(result.depths.filter((d: number) => d === 0)).toHaveLength(1);
    expect(result.depths.every((d: number) => d >= 0)).toBe(true);
  });
});

test.describe("custom topology", () => {
  const ids = ["a", "b", "c", "d", "e"];

  test("a bus carries end to end and closes a gap", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "bus" });
      // past BACK_TTL, so the join's back paths over the socket are gone and messages ride the line
      await world.advance(31_000);
      const line = ids.map((id: string) => world.links(id));
      nodes.a.send("e", "chat", { text: "hej" });
      await w.flush();
      const first = nodes.e.log.map((m: any) => m.hops.length);

      world.kill("c");
      await w.until(world, () => world.links("b").includes("d"));
      nodes.a.send("e", "chat", { text: "igen" });
      await w.flush();
      return { line, first, healed: [world.links("b"), world.links("d")], got: nodes.e.log.map((m: any) => m.data.text) };
    }, ids);

    expect(result.line).toEqual([["b"], ["a", "c"], ["b", "d"], ["c", "e"], ["d"]]);
    expect(result.first).toEqual([5]);
    expect(result.healed).toEqual([["a", "d"], ["b", "e"]]);
    expect(result.got).toEqual(["hej", "igen"]);
  });
});

test.describe("chord ring", () => {
  test("intervals wrap around and handle a === b", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { RING, between, upTo, distance, fingerStart } = (window as any).core.chordRing;
      return [
        between(1, RING - 2, 3), between(3, RING - 2, 3), between(RING - 2, RING - 2, 3),
        upTo(3, RING - 2, 3), upTo(RING - 2, RING - 2, 3),
        between(5, 5, 5), between(6, 5, 5), upTo(5, 5, 5),
        distance(RING - 1, 1), distance(1, 1), fingerStart(RING - 1, 1), fingerStart(0, 31),
      ];
    });

    expect(result).toEqual([true, false, false, true, false, false, true, true, 2, 0, 1, 2 ** 31]);
  });
});

test.describe("chord", () => {
  const ids = Array.from({ length: 32 }, (_, i) => `n${String(i).padStart(2, "0")}`);

  test("three nodes join and get the right successors", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = ["a", "b", "c"];
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      const truth = w.chordTruth(ids);
      const time = await w.until(world, () => truth.converged(nodes));
      return { time, succ: ids.map(id => nodes[id].topology.successors[0]), want: ids.map(truth.successorOf) };
    });

    expect(result.time).toBeGreaterThanOrEqual(0);
    expect(result.succ).toEqual(result.want);
  });

  test("32 nodes converge and lookups match brute force", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      const truth = w.chordTruth(ids);
      const time = await w.until(world, () => truth.converged(nodes), 60_000);
      // fingers settle too
      await world.run(10_000);

      const keys = Array.from({ length: 50 }, () => Math.floor(world.random() * 2 ** 32));
      const from = keys.map((_, i) => ids[i % ids.length]);
      const lookups = Promise.all(keys.map((key, i) => nodes[from[i]].topology.lookup(key)));
      await world.advance(100);
      const owners = await lookups;
      return { time, wrong: keys.filter((key, i) => owners[i] !== truth.ownerOf(key)).length };
    }, ids);

    expect(result.time).toBeGreaterThanOrEqual(0);
    expect(result.wrong).toBe(0);
  });

  test("it converges again after 30% die at once", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      await w.until(world, () => w.chordTruth(ids).converged(nodes), 60_000);
      await world.run(10_000);

      const dead = ids.filter((_, i) => i % 3 === 1);
      for (const id of dead) world.kill(id);
      const alive = ids.filter(id => !dead.includes(id));
      const truth = w.chordTruth(alive);
      const time = await w.until(world, () => truth.converged(nodes), 60_000);
      await world.run(10_000);

      const keys = Array.from({ length: 50 }, () => Math.floor(world.random() * 2 ** 32));
      const lookups = Promise.all(keys.map((key, i) => nodes[alive[i % alive.length]].topology.lookup(key)));
      await world.advance(100);
      const owners = await lookups;
      return { dead: dead.length, time, wrong: keys.filter((key, i) => owners[i] !== truth.ownerOf(key)).length };
    }, ids);

    expect(result.dead).toBe(11);
    expect(result.time).toBeGreaterThanOrEqual(0);
    expect(result.wrong).toBe(0);
  });

  test("a graceful leave splices within one round", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = ["a", "b", "c", "d", "e", "f"];
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      await w.until(world, () => w.chordTruth(ids).converged(nodes), 30_000);

      const truth = w.chordTruth(ids);
      const [pred, succ] = [truth.predecessorOf("c"), truth.successorOf("c")];
      nodes.c.leave();
      await w.flush();
      const spliced = nodes[pred].topology.successors[0] === succ && nodes[succ].topology.predecessor === pred;
      return { spliced };
    });

    expect(result.spliced).toBe(true);
  });

  test("a broadcast reaches all 32 exactly once", async ({ page }) => {
    const counts = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      await w.until(world, () => w.chordTruth(ids).converged(nodes), 60_000);
      await world.run(10_000);
      nodes.n05.broadcast("chat", { text: "hej" });
      await world.advance(100);
      return ids.map(id => nodes[id].log.length);
    }, ids);

    expect(counts).toEqual(ids.map(id => id === "n05" ? 0 : 1));
  });

  test("sendKey lands on the owner and range fires when a pred dies", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const { world, nodes } = await w.build(ids, { topology: "chord" });
      const truth = w.chordTruth(ids);
      await w.until(world, () => truth.converged(nodes), 30_000);
      await world.run(10_000);

      const keys = ["room-1", "room-2", "room-3", "user:42"];
      for (const key of keys) nodes.a.sendKey(key, "put", { key });
      await world.advance(100);
      const landed = keys.map(key => ids.find(id => nodes[id].log.some((m: any) => m.data.key === key)));
      const owners = keys.map(key => truth.ownerOf(w.core.keyHash(key)));

      const victim = truth.predecessorOf("d");
      const ranges: unknown[] = [];
      nodes.d.on("range", (event: CustomEvent) => ranges.push(event.detail));
      world.kill(victim);
      await world.run(3_000);
      return { landed, owners, ranges, victim, pred: nodes.d.topology.predecessor };
    });

    expect(result.landed).toEqual(result.owners);
    expect(result.ranges[0]).toEqual({ from: null, to: "d" });
    expect(result.pred).not.toBe(result.victim);
    expect(result.pred).not.toBeNull();
  });
});

test.describe("chord hooks and ring", () => {
  test("a wrapped factory picks fingers by rtt and hears every round", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      let rounds = 0;
      let picks = 0;
      w.core.registerTopology("chord-near", (config: any) => w.core.chordTopology(config, {
        pickFinger: (candidates: string[], ctx: any) => (picks++, w.core.proximity(candidates, ctx)),
        onStabilized: () => rounds++,
      }));
      const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const { world, nodes } = await w.build(ids, { topology: "chord-near" });
      const truth = w.chordTruth(ids);
      await w.until(world, () => truth.converged(nodes), 30_000);
      await world.run(10_000);

      const keys = Array.from({ length: 20 }, () => Math.floor(world.random() * 2 ** 32));
      const lookups = Promise.all(keys.map((key, i) => nodes[ids[i % ids.length]].topology.lookup(key)));
      await world.advance(100);
      const owners = await lookups;
      return { rounds, picks, wrong: keys.filter((key, i) => owners[i] !== truth.ownerOf(key)).length };
    });

    expect(result.rounds).toBeGreaterThan(8);
    expect(result.picks).toBeGreaterThan(0);
    expect(result.wrong).toBe(0);
  });

  test("a ring of 10 closes after 2 die", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = Array.from({ length: 10 }, (_, i) => `r${i}`);
      const { world, nodes } = await w.build(ids, { topology: "ring" });
      await w.until(world, () => w.chordTruth(ids).converged(nodes), 30_000);
      world.kill("r2");
      world.kill("r7");
      const alive = ids.filter(id => id !== "r2" && id !== "r7");
      const truth = w.chordTruth(alive);
      const time = await w.until(world, () => truth.converged(nodes), 30_000);
      nodes.r0.broadcast("chat", { text: "hej" });
      await world.advance(100);
      return {
        time,
        fingers: alive.every(id => nodes[id].topology.fingers.length === 0),
        got: alive.map(id => nodes[id].log.length),
      };
    });

    expect(result.time).toBeGreaterThanOrEqual(0);
    expect(result.fingers).toBe(true);
    expect(result.got).toEqual([0, 1, 1, 1, 1, 1, 1, 1]);
  });
});

test.describe("merge", () => {
  /** Waits for each side to settle, merges b into a, waits for `merged`, returns what the check saw. */
  const scenarios: Record<string, string> = {
    mesh: "ids.every(id => world.links(id).length === 10)",
    star: "ids.every(id => nodes[id].topology.hub === 'a0' && nodes[id].topology.members.length === 11)",
    multicast: "ids.every(id => nodes[id].topology.root === 'a0') && ids.every(id => { let at = id, n = 0; while (nodes[at].topology.parent && n++ < 12) at = nodes[at].topology.parent; return at === 'a0'; })",
    chord: "w.chordTruth(ids).converged(nodes)",
  };

  for (const [topology, check] of Object.entries(scenarios))
  {
    test(`two ${topology} networks of 6 and 5 become one`, async ({ page }) => {
      const result = await page.evaluate(async ({ topology, check }) => {
        const w = window as any;
        const { world, nodes, ids, idsA, idsB, infoA } = await w.buildTwo(topology);
        const done = new Function("w", "world", "nodes", "ids", `return ${check}`);
        // each side settles on its own first
        await world.run(15_000);

        const merged: string[] = [];
        for (const id of ids) nodes[id].on("merged", () => merged.push(id));
        await Promise.all([nodes.b0.merge(infoA.id), world.run(200)]);
        const time = await w.until(world, () => done(w, world, nodes, ids), 60_000);

        let lookups = 0;
        if (topology === "chord")
        {
          await world.run(10_000);
          const truth = w.chordTruth(ids);
          const keys = Array.from({ length: 20 }, () => Math.floor(world.random() * 2 ** 32));
          const pending = Promise.all(keys.map((key, i) => nodes[ids[i % ids.length]].topology.lookup(key)));
          await world.advance(100);
          const owners = await pending;
          lookups = keys.filter((key, i) => owners[i] !== truth.ownerOf(key)).length;
        }
        return {
          time,
          merged: merged.sort(),
          adopted: idsB.every((id: string) => nodes[id].info.id === infoA.id),
          kept: idsA.every((id: string) => nodes[id].info.id === infoA.id),
          lookups,
        };
      }, { topology, check });

      expect(result.time).toBeGreaterThanOrEqual(0);
      expect(result.merged).toEqual(["a0", "b0"]);
      expect(result.adopted).toBe(true);
      expect(result.kept).toBe(true);
      expect(result.lookups).toBe(0);
    });
  }

  test("refusals: no merge in the topology, another topology, no consent", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const reason = async (topology: string, options: any = {}) => {
        const { nodes, infoA } = await w.buildTwo(topology, { a: 2, b: 2, ...options });
        return nodes.b0.merge(infoA.id).then(() => "merged", (error: Error) => error.message);
      };
      return [
        await reason("bus"),
        await reason("mesh", { topologyB: "chord" }),
        await reason("mesh", { accept: false }),
      ];
    });

    expect(result).toEqual(["topology can't merge", "topology mismatch", "merge refused"]);
  });

  test("a merge of a network with itself changes nothing", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { world, nodes, idsA, infoA } = await w.buildTwo("mesh", { a: 4, b: 1, draft: { anchors: 2 } });
      await world.run(1_000);
      const before = idsA.map((id: string) => world.links(id));
      const anchor = idsA.find((id: string) => nodes[id].anchored && id !== "a0") ?? "a0";
      const [outcome] = await Promise.all([nodes[anchor].merge(infoA.id).then(() => "merged", (error: Error) => error.message), world.run(200)]);
      await world.run(2_000);
      return { outcome, same: JSON.stringify(idsA.map((id: string) => world.links(id))) === JSON.stringify(before), id: nodes[anchor].info.id === infoA.id };
    });

    expect(result).toEqual({ outcome: "merged", same: true, id: true });
  });
});

test.describe("split healing", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `c${String(i).padStart(2, "0")}`);

  /** A chord of 12 with 3 anchors splits into 8 and 4, then the links come back: one ring again. */
  const scenario = async (page: any, strayAnchor: boolean) => page.evaluate(async ({ ids, strayAnchor }: any) => {
    const w = window as any;
    const { world, nodes } = await w.build(ids, { topology: "chord", anchors: 3, beacon: 1_000 });
    await w.until(world, () => w.chordTruth(ids).converged(nodes) && ids.filter((id: string) => nodes[id].anchored).length === 3, 60_000);

    const anchors = ids.filter((id: string) => nodes[id].anchored);
    const plain = ids.filter((id: string) => !nodes[id].anchored);
    // the creator is the registry's first anchor, the one that beacons
    const stray = strayAnchor ? [...plain.slice(-3), anchors.find((id: string) => id !== "c00")] : plain.slice(-4);
    const rest = ids.filter((id: string) => !stray.includes(id));

    let tries = 0;
    for (const id of stray)
    {
      const bootstrap = nodes[id].bootstrap;
      const anchor = bootstrap.anchor.bind(bootstrap);
      bootstrap.anchor = (...args: unknown[]) => (tries++, anchor(...args));
    }

    world.split(rest, stray);
    await world.run(20_000);
    const apart = stray.every((id: string) => nodes[id].known().every((peer: string) => stray.includes(peer)));

    let merged = 0;
    for (const id of stray) nodes[id].on("merged", () => merged++);
    world.heal();
    const time = await w.until(world, () => w.chordTruth(ids).converged(nodes), 120_000);
    return { apart, tries, time, merged };
  }, { ids, strayAnchor });

  test("the part without anchors re-anchors and merges back", async ({ page }) => {
    const result = await scenario(page, false);
    expect(result.apart).toBe(true);
    expect(result.tries).toBeGreaterThan(0);
    expect(result.merged).toBeGreaterThan(0);
    expect(result.time).toBeGreaterThanOrEqual(0);
  });

  test("a part that holds an anchor merges back too", async ({ page }) => {
    const result = await scenario(page, true);
    expect(result.apart).toBe(true);
    expect(result.merged).toBeGreaterThan(0);
    expect(result.time).toBeGreaterThanOrEqual(0);
  });
});

test.describe("carried network", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];

  test("a chord carried over a chord lobby outlives its creator, without the server", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes: lobby } = await w.build(ids, { topology: "chord" });
      await w.until(world, () => w.chordTruth(ids).converged(lobby), 30_000);
      await world.run(5_000);

      // count carried traffic that falls back to the socket
      let rooms = 0;
      const forward = world.server.forward.bind(world.server);
      world.server.forward = (from: string, bytes: Uint8Array) => {
        if (w.read(bytes)?.meta.type === "network.room") rooms++;
        return forward(from, bytes);
      };

      const room = "game-1";
      const over = (id: string) => world.node(id, { bootstrap: new w.core.ParentBootstrap(lobby[id], room) });
      const carried: Record<string, any> = { c: over("c") };
      await carried.c.create({ name: "game", topology: "chord" });
      for (const id of ["d", "e", "f"])
      {
        carried[id] = over(id);
        await carried[id].join(carried.c.invite());
      }
      carried.g = over("g");
      await carried.g.join(carried.f.invite());

      const members = ["c", "d", "e", "f", "g"];
      const joined = await w.until(world, () => w.chordTruth(members).converged(carried), 30_000);

      world.kill("c");
      const rest = ["d", "e", "f", "g"];
      const healed = await w.until(world, () => w.chordTruth(rest).converged(carried), 30_000);
      await world.run(2_000);

      carried.d.broadcast("chat", { text: "hej" });
      await world.advance(100);
      const heard = rest.map(id => carried[id].log.filter((m: any) => m.type === "chat").length);

      return { joined, healed, heard, rooms, lobbyHeard: ids.map(id => lobby[id].log.length) };
    }, ids);

    expect(result.joined).toBeGreaterThanOrEqual(0);
    expect(result.healed).toBeGreaterThanOrEqual(0);
    expect(result.heard).toEqual([0, 1, 1, 1]);
    expect(result.rooms).toBe(0);
    // carried messages never surface as lobby app messages
    expect(result.lobbyHeard).toEqual(ids.map(() => 0));
  });

  test("an app-side rendezvous with Registry at the room's owner lets a node join by id", async ({ page }) => {
    const result = await page.evaluate(async (ids) => {
      const w = window as any;
      const { world, nodes: lobby } = await w.build(ids, { topology: "chord" });
      await w.until(world, () => w.chordTruth(ids).converged(lobby), 30_000);
      await world.run(5_000);

      // the app: every lobby node may own a room id, and keeps what it owns in a Registry
      const found: Record<string, any> = {};
      for (const id of ids)
      {
        let next = "";
        const registry = new w.Registry({ id: () => next });
        lobby[id].on("message", (event: CustomEvent) => {
          const { type, sender } = event.detail.meta;
          const data = event.detail.parse();
          if (type === "rendezvous.put")
          {
            next = data.invite.id;
            registry.register(sender, { name: data.invite.name, topology: data.invite.topology, private: true, meta: { invite: data.invite } });
          }
          if (type === "rendezvous.find")
          {
            const network = registry.networks.get(data.id);
            lobby[id].send(sender, "rendezvous.found", { id: data.id, invite: network?.meta?.invite ?? null });
          }
          if (type === "rendezvous.found") found[id] = data.invite;
        });
      }

      const room = "game-1";
      const over = (id: string) => world.node(id, { bootstrap: new w.core.ParentBootstrap(lobby[id], room) });
      const c = over("c");
      await c.create({ name: "game", topology: "chord" });
      lobby.c.sendKey(room, "rendezvous.put", { invite: c.invite() });
      await world.advance(100);

      // h knows only the id
      lobby.h.sendKey(room, "rendezvous.find", { id: room });
      await world.advance(100);
      const h = over("h");
      await h.join(found.h);
      await world.run(2_000);

      h.send("c", "chat", { text: "hej" });
      await world.advance(100);
      return { invite: found.h?.id, heard: c.log.map((m: any) => m.data.text) };
    }, ids);

    expect(result.invite).toBe("game-1");
    expect(result.heard).toEqual(["hej"]);
  });
});

test.describe("media", () => {
  test("multicast: streams flow only toward children, relay is the parent", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = "abcdefghijklm".split("");
      const { world, nodes } = await w.build(ids, { topology: { name: "multicast", fanout: 3 } });
      await world.run(500);

      // an inner node: it has a parent and children
      const id = ids.find(id => nodes[id].topology.parent && nodes[id].topology.children.length)!;
      const { parent, children } = nodes[id].topology;
      const stranger = ids.find(other => other !== id && other !== parent && !children.includes(other))!;
      const node = nodes[id].node;
      const plan = { channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } };
      return {
        toChild: node.media(children[0], plan),
        toParent: node.media(parent, plan),
        toStranger: node.media(stranger, plan),
        relay: node.relay("cam") === parent,
      };
    });

    expect(result.toChild).toEqual({ channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } });
    expect(result.toParent).toEqual({ channels: { chat: { ordered: true } }, streams: {} });
    expect(result.toStranger).toEqual({ channels: { chat: { ordered: true } }, streams: {} });
    expect(result.relay).toBe(true);
  });

  test("over real WebRTC links the plan's channel opens and a stream arrives", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "headless WebRTC media is only reliable in chromium");

    const result = await page.evaluate(async () => {
      const w = window as any;
      const server = new w.core.MemoryServer();
      const node = (me: string) => new w.core.Network({ me, bootstrap: server.connect(me), connector: new w.core.PeerConnector() });
      const a = node("a");
      const b = node("b");
      const media = { channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } };

      const opened = new Promise(resolve => b.media.addEventListener("channel-open", (event: CustomEvent) => resolve(event.detail)));
      const streamed = new Promise(resolve => b.media.addEventListener("stream", (event: CustomEvent) => resolve({ peer: event.detail.peer, name: event.detail.name })));

      await a.create({ name: "call", topology: "mesh", media });
      await b.join(a.info.id);
      const open = await opened;

      const heard = new Promise(resolve => b.media.channel("chat").addEventListener("message", (event: CustomEvent) => resolve(event.detail.data)));
      a.media.channel("chat").send("b", "hej");

      const canvas = document.createElement("canvas");
      const draw = setInterval(() => canvas.getContext("2d")!.fillRect(0, 0, Math.random() * 100, 10), 50);
      await a.media.start("cam", canvas.captureStream(10));
      const stream = await streamed;
      clearInterval(draw);

      const result = { plan: b.media.plan, open, heard: await heard, stream };
      a.close();
      b.close();
      return result;
    });

    expect(result.plan).toEqual({ channels: { chat: { ordered: true } }, streams: { cam: { kind: "video" } } });
    expect(result.open).toEqual({ peer: "a", label: "chat" });
    expect(result.heard).toBe("hej");
    expect(result.stream).toEqual({ peer: "a", name: "cam" });
  });
});

test.describe("update", () => {
  test("an anchor updates the network: the registry and every member get it", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = ["a", "b", "c", "d"];
      const { world, nodes, info } = await w.build(ids, { topology: "chord", beacon: 0 });
      await w.until(world, () => w.chordTruth(ids).converged(nodes), 30_000);
      await world.run(10_000);

      const heard: string[] = [];
      for (const id of ids) nodes[id].on("update", () => heard.push(id));
      const media = { channels: { chat: { ordered: true } } };
      await nodes.a.update({ name: "renamed", meta: { mode: "ffa" }, media, password: "secret" });
      await world.advance(100);

      const refused = await nodes.c.update({ name: "nope" }).then(() => null, (error: Error) => error.message);
      const registered = world.server.registry.info(world.server.registry.networks.get(info.id));
      const late = world.node("e");
      const wrong = await late.join(info.id).then(() => "joined", (error: Error) => error.message);

      return {
        names: ids.map(id => nodes[id].info.name),
        metas: ids.map(id => nodes[id].info.meta?.mode),
        plans: ids.map(id => nodes[id].media.plan),
        heard: heard.sort(),
        refused,
        registered: { name: registered.name, meta: registered.meta },
        beacon: nodes.b.info.beacon,
        wrong,
      };
    });

    expect(result.names).toEqual(["renamed", "renamed", "renamed", "renamed"]);
    expect(result.metas).toEqual(["ffa", "ffa", "ffa", "ffa"]);
    expect(result.plans).toEqual(Array(4).fill({ channels: { chat: { ordered: true } } }));
    expect(result.heard).toEqual(["a", "b", "c", "d"]);
    expect(result.refused).toBe("only an anchor can update the network");
    expect(result.registered).toEqual({ name: "renamed", meta: { mode: "ffa" } });
    expect(result.beacon).toBe(0);
    expect(result.wrong).toBe("wrong password");
  });
});

test.describe("routing", () => {
  const ids = Array.from({ length: 16 }, (_, i) => `r${String(i).padStart(2, "0")}`);
  // most hops a unicast may take among 16 (hops lists the sender and the receiver too)
  const cases: [string | object, number][] = [
    ["mesh", 2],
    ["star", 3],
    [{ name: "multicast", fanout: 3 }, 6],
    ["chord", 6],
    ["ring", 10],
  ];

  for (const [topology, most] of cases)
  {
    const name = typeof topology === "string" ? topology : (topology as any).name;
    test(`${name}: every pair is delivered once, within ${most} hops, and a broadcast reaches all once`, async ({ page }) => {
      // known bug: the tree floods a unicast; a sibling link plus a back path brings a second copy, and only broadcasts are deduplicated
      test.fail(name === "multicast", "a unicast can arrive twice in the tree");

      const result = await page.evaluate(async ({ ids, topology }) => {
        const w = window as any;
        const { world, nodes } = await w.build(ids, { topology });
        const chord = topology === "chord" || topology === "ring";
        if (chord) await w.until(world, () => w.chordTruth(ids).converged(nodes), 60_000);
        await world.run(chord ? 10_000 : 20_000);

        for (const from of ids) for (const to of ids) if (from !== to) nodes[from].send(to, "chat", { from, to });
        await world.run(1_000);
        const unicast = ids.map(id => nodes[id].log.map((m: any) => ({ ...m.data, hops: m.hops })));
        for (const id of ids) nodes[id].log.length = 0;

        nodes[ids[5]].broadcast("all", {});
        await world.run(1_000);
        return { unicast, broadcast: ids.map(id => nodes[id].log.length) };
      }, { ids, topology });

      result.unicast.forEach((got: any[], i: number) => {
        const me = ids[i];
        expect(got.map(m => m.from).sort()).toEqual(ids.filter(id => id !== me));
        for (const m of got)
        {
          expect(m.to).toBe(me);
          expect(m.hops[0]).toBe(m.from);
          expect(m.hops[m.hops.length - 1]).toBe(me);
          expect(m.hops.length).toBeLessThanOrEqual(most);
        }
      });
      expect(result.broadcast).toEqual(ids.map((_, i) => i === 5 ? 0 : 1));
    });
  }

  test("star: leaf to leaf goes through the hub", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const ids = ["a", "b", "c", "d", "e", "f"];
      const { world, nodes } = await w.build(ids, { topology: "star" });
      await world.run(5_000);
      const hub = nodes.a.topology.hub;
      // the standby links to everyone, so take two other leaves
      const standby = nodes.a.topology.members.filter((id: string) => id !== hub).sort()[0];
      const [x, y] = ids.filter(id => id !== hub && id !== standby);
      nodes[x].send(y, "chat", {});
      await world.advance(100);
      return { hub, x, y, hops: nodes[y].log[0]?.hops };
    });

    expect(result.hops).toEqual([result.x, result.hub, result.y]);
  });

  test("mesh: an app message under another peer's id is dropped", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      const { nodes } = await w.build(["a", "b", "c"], { topology: "mesh" });
      const forged = w.Message.Create({ type: "chat", sender: "a", receiver: "c", network: nodes.b.info.id }, {});
      nodes.b.links.get("c").link.send(forged.toBinary(true));
      nodes.b.send("c", "chat", {});
      await w.flush();
      return nodes.c.log.map((m: any) => m.from);
    });

    expect(result).toEqual(["b"]);
  });
});

test.describe("topology config", () => {
  test("names and configs resolve, bad ones fall back to mesh and say why", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { core } = window as any;
      const errors: string[] = [];
      const report = (error: Error) => errors.push(error.name);
      const builtIns = ["mesh", "star", "multicast", "chord", "ring"].map(name => core.resolveTopology(name, report) === core.meshTopology);
      const unknown = core.resolveTopology({ name: "nope" }, report) === core.meshTopology;
      const fanouts = [0, -1, 1.5, NaN, "5", 65].map(fanout => core.resolveTopology({ name: "multicast", fanout }, report) === core.meshTopology);
      const custom = core.resolveTopology({ name: "bus" }) !== core.meshTopology;
      const reserved = ["mesh", "star", "multicast", "chord", "ring"].map(name => {
        try { core.registerTopology(name, () => core.meshTopology); return "ok"; }
        catch (error) { return (error as Error).name; }
      });
      return { builtIns, unknown, fanouts, custom, reserved, errors };
    });

    // mesh resolves to itself, the rest to their own
    expect(result.builtIns).toEqual([true, false, false, false, false]);
    expect(result.unknown).toBe(true);
    expect(result.fanouts).toEqual(Array(6).fill(true));
    expect(result.custom).toBe(true);
    expect(result.reserved).toEqual(Array(5).fill("RangeError"));
    expect(result.errors).toEqual(Array(7).fill("RangeError"));
  });
});
