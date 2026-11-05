import * as core from '@papit/webrtc';
import { BROADCAST, Registry, read, SERVER, SignalType, Message } from '@papit/peer-message';

/** Seeded random in [0, 1). */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Drains every queued microtask (MemoryLink, MemoryServer) with one real macrotask. A MessageChannel,
 * not setTimeout: nested timeouts are clamped to 4 ms, which makes long simulations crawl.
 */
const channel = new MessageChannel();
const flushes = [];
channel.port1.onmessage = () => flushes.shift()?.();
function flush() {
  return new Promise(resolve => {
    flushes.push(resolve);
    channel.port2.postMessage(null);
  });
}

/**
 * A simulated world: a fake clock, a seeded random, a MemoryServer and MemoryLinks between nodes.
 * Time only moves with advance/run.
 */
function createWorld({ seed = 1 } = {}) {
  let now = 0;
  let nextTimer = 1;
  const timers = new Map(); // id → { at, fn, owner }
  const killed = new Set();
  const tracked = []; // { a, b, link }
  const networks = new Set();
  let groups = null;

  const clockFor = (owner) => ({
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextTimer++;
      if (!killed.has(owner)) timers.set(id, { at: now + Math.max(0, ms), fn, owner });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });

  const blocked = (a, b) => !!groups && ((groups[0].has(a) && groups[1].has(b)) || (groups[1].has(a) && groups[0].has(b)));
  const server = new core.MemoryServer();
  const random = mulberry32(seed);

  const world = {
    server,
    random,
    networks,
    get now() { return now; },

    /** MemoryWorld: links `network` to the same network on `peer`, unless split or dead. */
    pair(network, peer) {
      if (killed.has(peer) || killed.has(network.me) || blocked(network.me, peer)) return null;
      const id = network.info?.id;
      const other = [...networks].find(n => n.me === peer && !n.closed && n.ids.has(id));
      if (!other) return null;

      const [mine, theirs] = core.MemoryLink.pair(network.me, peer);
      tracked.push({ a: network.me, b: peer, link: mine });
      other.attach(theirs);
      return mine;
    },

    node(id, options = {}) {
      const network = new core.Network({
        me: id,
        connector: new core.MemoryConnector(world),
        clock: clockFor(id),
        random,
        ...options,
        bootstrap: options.bootstrap ?? server.connect(id),
      });
      network.log = [];
      network.on("message", event => network.log.push({ from: event.detail.meta.sender, type: event.detail.meta.type, data: event.detail.parse(), hops: event.detail.meta.hops }));
      networks.add(network);
      return network;
    },

    /** Dies without a word: links close without network.leave, timers stop, the socket goes. */
    kill(id) {
      killed.add(id);
      for (const [timer, entry] of timers) if (entry.owner === id) timers.delete(timer);
      for (const { a, b, link } of tracked) if (a === id || b === id) link.close();
      for (const network of networks) if (network.me === id) network.bootstrap.close();
    },

    /** Goes silent the way a closed tab does before ICE fails: links stay open but carry nothing, timers stop, the socket goes. */
    freeze(id) {
      killed.add(id);
      for (const [timer, entry] of timers) if (entry.owner === id) timers.delete(timer);
      for (const { a, b, link } of tracked) if (a === id || b === id) link.send = () => true;
      for (const network of networks) if (network.me === id) network.bootstrap.close();
    },

    /** Closes every link between the groups and blocks new ones until heal(). */
    split(a, b) {
      groups = [new Set(a), new Set(b)];
      for (const { a: x, b: y, link } of tracked) if (blocked(x, y)) link.close();
    },

    heal() {
      groups = null;
    },

    /** Moves time by ms, running due timers in order with a flush between them. */
    async advance(ms) {
      const end = now + ms;
      for (; ;)
      {
        let next = null;
        for (const [id, entry] of timers)
        {
          if (entry.at <= end && (!next || entry.at < next[1].at)) next = [id, entry];
        }
        if (!next) break;

        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
        await flush();
      }
      now = end;
      await flush();
    },

    /** advance in 50 ms steps. */
    async run(ms) {
      for (let t = 0; t < ms; t += 50) await world.advance(Math.min(50, ms - t));
    },

    links(id) {
      const network = [...networks].find(n => n.me === id && !n.closed);
      return network ? [...network.linked].sort() : [];
    },

    /** Live timers, of one node or all. */
    pending(id) {
      return [...timers.values()].filter(entry => id === undefined || entry.owner === id).length;
    },

    /** MemoryLinks opened between a and b, ever. */
    paired(a, b) {
      return tracked.filter(t => (t.a === a && t.b === b) || (t.a === b && t.b === a)).length;
    },
  };

  return world;
}

/**
 * The smallest topology: a newcomer links to its entry, routing is direct only.
 * `api.ctx` lets tests drive the context; `ping` is answered with `pong` on the send path.
 */
const tiny = (ctx) => {
  const log = [];
  return {
    api: { ctx, log },
    start(entry) {
      if (entry) ctx.connect(entry);
    },
    message(from, type, payload) {
      log.push({ from, type, payload });
      if (type === "ping") ctx.send(from, "pong", payload);
    },
    route(meta) {
      if (meta.receiver === BROADCAST) return [...ctx.links].filter(peer => !meta.hops.includes(peer));
      return ctx.links.has(meta.receiver) ? [meta.receiver] : [];
    },
  };
};
core.registerTopology("tiny", () => tiny);

/**
 * A third-party topology, built from the context alone: a line in join order. The tail takes each newcomer,
 * every node knows the one before its prev, so a gap closes on its own. No merge, no owner.
 */
const bus = (ctx) => {
  let prev = null;
  let next = null;
  let before = null;
  let joined = null;
  const wanted = new Set();
  const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;

  const sync = () => {
    const want = new Set([prev, next].filter(Boolean));
    for (const peer of want) ctx.connect(peer);
    for (const peer of wanted) if (!want.has(peer)) ctx.disconnect(peer);
    wanted.clear();
    for (const peer of want) wanted.add(peer);
  };

  const linked = () => {
    ctx.send(prev, "bus.next", {});
    joined?.();
    joined = null;
  };

  return {
    api: { get prev() { return prev; }, get next() { return next; } },
    start(entry) {
      if (!entry) return;
      return new Promise(resolve => {
        joined = resolve;
        ctx.send(entry, "bus.tail", {});
      });
    },
    message(from, type, payload, meta) {
      if (type === "bus.tail")
      {
        if (next) ctx.forward(next, meta);
        else ctx.send(meta.sender, "bus.prev", { before: prev });
      }
      if (type === "bus.prev" && (payload.before === null || isId(payload.before)))
      {
        if (prev && prev !== from) return;
        const fresh = prev !== from;
        prev = from;
        before = payload.before;
        sync();
        if (fresh && ctx.links.has(prev)) linked();
      }
      if (type === "bus.next")
      {
        next = from;
        sync();
        ctx.send(from, "bus.prev", { before: prev });
      }
      if (type === "bus.before" && from === prev && (payload.before === null || isId(payload.before))) before = payload.before;
    },
    link(peer, open) {
      if (open)
      {
        if (peer === prev) linked();
        return;
      }
      if (peer === next) next = null;
      if (peer === prev)
      {
        // the gap closes from behind: link to the one before, and tell my next about it
        prev = before;
        before = null;
        if (next) ctx.send(next, "bus.before", { before: prev });
      }
      sync();
    },
    route(meta) {
      if (ctx.links.has(meta.receiver)) return [meta.receiver];
      // a missing neighbour sits behind the gap: let the bootstrap reach it
      if (meta.receiver === prev || meta.receiver === next) return [];
      return [prev, next].filter(peer => peer && ctx.links.has(peer) && !meta.hops.includes(peer));
    },
    known() {
      return [prev, next].filter(Boolean);
    },
  };
};
core.registerTopology("bus", () => bus);

/** Chord by brute force over the live ids: who owns a key, who follows an id. */
function chordTruth(ids) {
  const sorted = [...ids].sort((a, b) => core.fnv1a(a) - core.fnv1a(b));
  const ownerOf = (key) => sorted.find(id => core.fnv1a(id) >= key) ?? sorted[0];
  const successorOf = (id) => sorted[(sorted.indexOf(id) + 1) % sorted.length];
  const predecessorOf = (id) => sorted[(sorted.indexOf(id) - 1 + sorted.length) % sorted.length];
  const converged = (nodes) => ids.every(id => nodes[id].topology.successors[0] === successorOf(id) && nodes[id].topology.predecessor === predecessorOf(id));
  return { ownerOf, successorOf, predecessorOf, converged };
}

/** Runs the world in 50 ms steps until check() is true or ms ran out. Returns the time it took, or -1. */
async function until(world, check, ms = 5000) {
  const start = world.now;
  while (world.now - start <= ms)
  {
    if (check()) return world.now - start;
    await world.run(50);
  }
  return -1;
}

/** a creates a tiny network, the rest join it one after another. */
async function build(ids, draft = {}) {
  const world = createWorld();
  const nodes = Object.fromEntries(ids.map(id => [id, world.node(id)]));
  const info = await nodes[ids[0]].create({ name: "smoke", topology: "tiny", ...draft });
  for (const id of ids.slice(1)) await nodes[id].join(info.id);
  await flush();
  return { world, nodes, info };
}

/**
 * Two networks in one world: a0…a(n-1) and b0…b(m-1), each created by its 0 and joined in order.
 * The a side accepts merges unless `accept` is false.
 */
async function buildTwo(topology, { a = 6, b = 5, accept = true, topologyB = topology, draft = {} } = {}) {
  const world = createWorld();
  const idsA = Array.from({ length: a }, (_, i) => `a${i}`);
  const idsB = Array.from({ length: b }, (_, i) => `b${i}`);
  const nodes = {};
  for (const id of idsA) nodes[id] = world.node(id, accept ? { acceptMerge: () => true } : {});
  for (const id of idsB) nodes[id] = world.node(id);

  const infoA = await nodes.a0.create({ name: "a", topology, ...draft });
  for (const id of idsA.slice(1)) await nodes[id].join(infoA.id);
  const infoB = await nodes.b0.create({ name: "b", topology: topologyB });
  for (const id of idsB.slice(1)) await nodes[id].join(infoB.id);
  await flush();
  return { world, nodes, idsA, idsB, ids: [...idsA, ...idsB], infoA, infoB };
}

/** A welcomed SocketLink stand-in whose server is a Registry: signal.* requests are answered, the rest is dropped. */
function fakeSocket(me) {
  const registry = new Registry();
  const socket = new EventTarget();
  socket.me = me;
  socket.sent = [];
  socket.send = (bytes) => {
    const message = read(bytes);
    socket.sent.push(message.meta.type);
    const { type, id } = message.meta;
    const payload = message.parse();
    const replies = type === SignalType.Register ? registry.register(me, payload)
      : type === SignalType.Join ? registry.join(me, payload, id)
      : type === SignalType.Anchor ? registry.anchor(me, payload, id)
      : [];
    for (const { to, message: reply } of replies)
    {
      if (to !== me) continue;
      queueMicrotask(() => socket.dispatchEvent(new CustomEvent("message", { detail: reply.toBinary(true) })));
    }
    return true;
  };
  return socket;
}

Object.assign(window, { read, Registry, Message, SocketLink: core.SocketLink, buildTwo, chordTruth, until, fakeSocket, core, createWorld, build, flush, BROADCAST });
window.ready = true;
