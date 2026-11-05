import { BROADCAST, isKeyReceiver, KEY_PREFIX, MAX_ID_LENGTH, MAX_TTL } from "@papit/peer-message";
import type { Meta, PeerId, TopologyConfig } from "@papit/peer-message";

import type { Hop, SendOptions, Topology, TopologyContext, TopologyNode } from "../../types";
import { between, distance, fingerStart, fnv1a, keyHash, RING, upTo } from "./ring";

const LOOKUP_TIMEOUT = 5_000;
/** Most ids one chord message may list. */
const MAX_LIST = 64;

const isId = (x: unknown): x is PeerId => typeof x === "string" && x.length > 0 && x.length <= MAX_ID_LENGTH;
const isIds = (x: unknown): x is PeerId[] => Array.isArray(x) && x.length <= MAX_LIST && x.every(isId);
const isKey = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < RING;
const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

export type ChordApi = {
  /** The node that owns `key` (a 32-bit ring position). `via`: ask through these waypoints (another ring). */
  lookup(key: number, options?: SendOptions): Promise<PeerId>;
  /** Asks `peer` for its successor list. */
  successorsOf(peer: PeerId): Promise<PeerId[]>;
  readonly successors: readonly PeerId[];
  readonly predecessor: PeerId | null;
  readonly fingers: readonly (PeerId | null)[];
};

/** Picks finger `i` among `candidates`: the lookup owner first, then its successors inside the finger's interval. */
export type PickFinger = (candidates: PeerId[], ctx: TopologyContext) => PeerId | Promise<PeerId>;

export type ChordState = { predecessor: PeerId | null; successors: readonly PeerId[]; fingers: readonly (PeerId | null)[] };

/** Local policies: they never go over the wire, every node may run its own. */
export type ChordHooks = {
  pickFinger?: PickFinger;
  /** Called after each stabilize round. */
  onStabilized?(state: ChordState): void;
};

/** Proximity neighbour selection: the candidate with the lowest round trip among the linked ones. */
export const proximity: PickFinger = async (candidates, ctx) => {
  let best = candidates[0];
  let low = Infinity;
  for (const peer of candidates)
  {
    if (!ctx.links.has(peer)) continue;
    const ms = await ctx.rtt(peer).catch(() => Infinity);
    if (ms < low)
    {
      low = ms;
      best = peer;
    }
  }
  return best;
};

/** Reads an integer option from the shared config. */
function option(config: Partial<TopologyConfig>, name: string, fallback: number, min: number, max: number) {
  const value = config[name] ?? fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
  {
    throw new RangeError(`${name} must be an integer in ${min}–${max}`);
  }
  return value;
}

/**
 * Chord (Stoica et al.): nodes sit on a 32-bit ring by the hash of their id, each owns the keys from its
 * predecessor up to itself. Successor lists keep the ring whole, fingers make lookups O(log n),
 * broadcast follows El-Ansary et al. so every node gets it once.
 *
 * `fingers: 0` is a plain ring. A latch, another hash or other policies come from `hooks` or by wrapping the factory.
 *
 * @fires range - `CustomEvent<{ from, to }>` when the predecessor changes: the keys this node owns moved
 * @throws {RangeError} for an option out of range
 */
export function chordTopology(config: Partial<TopologyConfig> = {}, hooks: ChordHooks = {}): Topology {
  const successors = option(config, "successors", 4, 1, 16);
  const fingers = option(config, "fingers", 32, 0, 32);
  const stabilize = option(config, "stabilize", 1000, 10, 600_000);
  const fixFingers = option(config, "fixFingers", 250, 10, 600_000);

  return (ctx: TopologyContext): TopologyNode<ChordApi> => {
    const hashes = new Map<PeerId, number>();
    const h = (id: PeerId) => {
      let hash = hashes.get(id);
      if (hash === undefined)
      {
        if (hashes.size > 4096) hashes.clear();
        hash = fnv1a(id);
        hashes.set(id, hash);
      }
      return hash;
    };
    const me = ctx.me;
    const mine = h(me);

    let pred: PeerId | null = null;
    let succ: PeerId[] = [me];
    const finger: (PeerId | null)[] = Array(fingers).fill(null);
    let next = 0;
    let counter = 0;
    let joined: (() => void) | null = null;
    const pending = new Map<string, { resolve: (owner: PeerId) => void; reject: (error: Error) => void; cancel: () => void }>();
    /** Who told me about a peer: the waypoints to reach it before a link exists. */
    const heard = new Map<PeerId, PeerId[]>();
    const states = new Map<PeerId, Array<(list: PeerId[]) => void>>();
    const unified = new Set<string>();
    const wanted = new Set<PeerId>();

    const alone = () => succ[0] === me;

    const setPred = (peer: PeerId | null) => {
      if (pred === peer) return;
      pred = peer;
      ctx.emit("range", { from: pred, to: me });
    };

    /** The owner of `key` when this node can tell without asking: me or my successor. */
    const answer = (key: number): PeerId | null => {
      if (alone()) return me;
      if (pred && upTo(key, h(pred), mine)) return me;
      if (upTo(key, mine, h(succ[0]))) return succ[0];
      return null;
    };

    /** The linked node that precedes `key` most closely, or null. */
    const closest = (key: number): PeerId | null => {
      const limit = distance(mine, key);
      let best: PeerId | null = null;
      let gap = -1;
      for (const peer of [...succ, ...finger])
      {
        if (!peer || peer === me || !ctx.links.has(peer)) continue;
        const d = distance(mine, h(peer));
        if (d < limit && d > gap)
        {
          best = peer;
          gap = d;
        }
      }
      return best;
    };

    const viaFor = (peer: PeerId): SendOptions | undefined => {
      if (ctx.links.has(peer)) return undefined;
      const via = heard.get(peer);
      return via?.length && !via.includes(peer) && ctx.links.has(via[0]) ? { via } : undefined;
    };

    /** Want pred, successors and fingers; let go of the rest. */
    const sync = () => {
      const want = new Set<PeerId>();
      for (const peer of [pred, ...succ, ...finger]) if (peer && peer !== me) want.add(peer);

      for (const peer of want) ctx.connect(peer, viaFor(peer));
      for (const peer of wanted) if (!want.has(peer)) ctx.disconnect(peer);
      wanted.clear();
      for (const peer of want) wanted.add(peer);
    };

    const setSuccessors = (list: PeerId[]) => {
      const unique = [...new Set(list)].filter(peer => peer !== me).slice(0, successors);
      succ = unique.length ? unique : [me];
    };

    /** Sends `chord.find` for `key` to `target` and waits for `chord.found`. */
    const ask = (target: PeerId, key: number, options?: SendOptions) => new Promise<PeerId>((resolve, reject) => {
      const id = String(++counter);
      const cancel = ctx.after(LOOKUP_TIMEOUT, () => {
        pending.delete(id);
        reject(new Error(`lookup of ${key} timed out`));
      });
      pending.set(id, { resolve, reject, cancel });
      ctx.send(target, "chord.find", { key, id }, options);
    });

    const lookup = (key: number, options?: SendOptions) => {
      if (options?.via?.length) return ask(options.via[options.via.length - 1], key, { via: options.via.slice(0, -1) });
      const owner = answer(key);
      if (owner) return Promise.resolve(owner);
      return ask(closest(key) ?? succ[0], key);
    };

    const successorsOf = (peer: PeerId) => new Promise<PeerId[]>((resolve, reject) => {
      const cancel = ctx.after(LOOKUP_TIMEOUT, () => reject(new Error(`no state from ${peer}`)));
      const waiting = states.get(peer) ?? [];
      waiting.push(list => {
        cancel();
        resolve(list);
      });
      states.set(peer, waiting);
      ctx.send(peer, "chord.ask", {});
    });

    const stabilized = () => hooks.onStabilized?.({ predecessor: pred, successors: succ, fingers: finger });

    /** The next hop toward the owner of `key`. */
    const step = (key: number, meta: Meta): Hop[] => {
      if (!alone() && ctx.links.has(succ[0]) && upTo(key, mine, h(succ[0]))) return [succ[0]];
      const peer = closest(key);
      return peer && !meta.hops.includes(peer) ? [peer] : [];
    };

    const keyOf = (receiver: string) => parseInt(receiver.slice(KEY_PREFIX.length), 16);

    const handleStabilize = () => {
      if (!alone()) return void ctx.send(succ[0], "chord.ask", {});
      if (pred && pred !== me)
      {
        setSuccessors([pred]);
        sync();
      }
      stabilized();
    };

    const handleFixFingers = () => {
      next = (next + 1) % fingers;
      const i = next;
      const key = fingerStart(mine, i);
      const set = (owner: PeerId | null) => {
        if (finger[i] === owner) return;
        finger[i] = owner;
        sync();
      };

      if (alone()) return set(null);
      if (upTo(key, mine, h(succ[0]))) return set(succ[0]);
      lookup(key)
        .then(owner => owner === me ? null : pick(i, key, owner))
        .then(set, () => { });
    };

    /** The hook picks among the owner and its successors that still fall inside finger i's interval. */
    const pick = async (i: number, start: number, owner: PeerId) => {
      if (!hooks.pickFinger) return owner;
      const width = i < 32 ? 2 ** i : RING;
      const after = await successorsOf(owner).catch(() => [] as PeerId[]);
      const candidates = [owner, ...after.filter(peer => peer !== me && peer !== owner && distance(start, h(peer)) < width)];
      const chosen = await hooks.pickFinger(candidates, ctx);
      return candidates.includes(chosen) ? chosen : owner;
    };

    const handleState = (from: PeerId, payload: unknown) => {
      if (!isObject(payload) || !(payload.pred === null || isId(payload.pred)) || !isIds(payload.succ)) return;
      const waiting = states.get(from);
      states.delete(from);
      for (const resolve of waiting ?? []) resolve(payload.succ);
      if (from !== succ[0]) return;

      const x = payload.pred as PeerId | null;
      for (const peer of payload.succ) if (!heard.has(peer)) heard.set(peer, [from]);

      if (x && x !== me && between(h(x), mine, h(from)))
      {
        heard.set(x, [from]);
        setSuccessors([x, from, ...payload.succ]);
      }
      else setSuccessors([from, ...payload.succ]);

      if (!alone()) ctx.send(succ[0], "chord.notify", {}, viaFor(succ[0]));
      sync();
      stabilized();
    };

    /**
     * Ring unification (Shafaat, Ghodsi, Haridi): find my successor in the other ring through the bridge,
     * take it when it's closer than mine. Stabilize knits the rest. In my own ring nothing changes.
     */
    const handleUnify = (payload: unknown) => {
      if (!isObject(payload) || !isId(payload.bridge) || !isId(payload.foreign) || !isId(payload.id)) return;
      if (unified.has(payload.id)) return;
      unified.add(payload.id);
      if (unified.size > 64) unified.delete(unified.values().next().value!);

      const via = payload.bridge === me ? [payload.foreign] : [payload.bridge, payload.foreign];
      lookup(mine, { via }).then(owner => {
        if (owner === me || succ.includes(owner)) return;
        if (!alone() && !between(h(owner), mine, h(succ[0]))) return;
        heard.set(owner, via);
        setSuccessors([owner, ...succ]);
        ctx.send(owner, "chord.notify", {}, { via });
        sync();
      }, () => { });
    };

    const handleNotify = (from: PeerId) => {
      if (from === me) return;
      if (!pred || between(h(from), h(pred), mine))
      {
        setPred(from);
        sync();
      }
    };

    const handleLeaving = (from: PeerId, payload: unknown) => {
      if (!isObject(payload)) return;
      if (isIds(payload.succ) && succ.includes(from))
      {
        setSuccessors([...payload.succ, ...succ].filter(peer => peer !== from));
        sync();
      }
      if ((payload.pred === null || isId(payload.pred)) && pred === from)
      {
        const before = payload.pred as PeerId | null;
        setPred(before === me ? null : before);
        sync();
      }
    };

    return {
      api: {
        lookup,
        successorsOf,
        get successors() { return succ; },
        get predecessor() { return pred; },
        get fingers() { return finger; },
      },

      start(entry) {
        ctx.every(stabilize, handleStabilize);
        if (fingers > 0) ctx.every(fixFingers, handleFixFingers);
        if (!entry) return;

        return ask(entry, mine).then(owner => new Promise<void>(resolve => {
          setSuccessors([owner]);
          sync();
          if (ctx.links.has(owner)) return resolve();
          joined = resolve;
        }));
      },

      message(from, type, payload, meta) {
        switch (type)
        {
          case "chord.find": {
            if (!isObject(payload) || !isKey(payload.key) || !isId(payload.id)) return;
            const owner = answer(payload.key);
            if (owner) return void ctx.send(meta.sender, "chord.found", { id: payload.id, owner });
            ctx.forward(closest(payload.key) ?? succ[0], meta);
            return;
          }

          case "chord.found": {
            if (!isObject(payload) || !isId(payload.id) || !isId(payload.owner)) return;
            const request = pending.get(payload.id);
            if (!request) return;
            request.cancel();
            pending.delete(payload.id);
            request.resolve(payload.owner);
            return;
          }

          case "chord.ask":
            ctx.send(from, "chord.state", { pred, succ });
            return;

          case "chord.state":
            handleState(from, payload);
            return;

          case "chord.notify":
            handleNotify(from);
            return;

          case "chord.leaving":
            handleLeaving(from, payload);
            return;

          case "chord.unify":
            handleUnify(payload);
            return;
        }
      },

      link(peer, open) {
        if (open)
        {
          if (joined && peer === succ[0])
          {
            joined();
            joined = null;
          }
          return;
        }

        if (peer === pred) setPred(null);
        if (succ.includes(peer))
        {
          const rest = succ.filter(x => x !== peer);
          const live = finger.find(f => f && f !== peer && ctx.links.has(f));
          setSuccessors(rest.length ? rest : live ? [live] : []);
        }
        for (let i = 0; i < finger.length; i++) if (finger[i] === peer) finger[i] = null;
        heard.delete(peer);
        sync();
      },

      route(meta: Meta) {
        if (meta.receiver === BROADCAST)
        {
          // El-Ansary: each target covers the ring up to the next one, the last up to my own limit
          const limit = isId(meta.hint) ? meta.hint : me;
          const targets = [...new Set([...succ, ...finger])]
            .filter((peer): peer is PeerId => !!peer && peer !== me && ctx.links.has(peer) && between(h(peer), mine, h(limit)))
            .sort((a, b) => distance(mine, h(a)) - distance(mine, h(b)));
          return targets.map((peer, i): Hop => [peer, targets[i + 1] ?? limit]);
        }
        if (isKeyReceiver(meta.receiver)) return step(keyOf(meta.receiver), meta);
        if (ctx.links.has(meta.receiver)) return [meta.receiver];
        return step(h(meta.receiver), meta);
      },

      filter(meta: Meta) {
        if (!isKeyReceiver(meta.receiver)) return undefined;
        const key = keyOf(meta.receiver);
        if (alone() || (pred && upTo(key, h(pred), mine))) return "deliver";
        return undefined;
      },

      owner(key) {
        return lookup(keyHash(key));
      },

      merge(bridge) {
        const unify = { bridge: me, foreign: bridge, id: `${me}:${bridge}:${++counter}` };
        ctx.send(BROADCAST, "chord.unify", unify);
        handleUnify(unify);
      },

      // a plain ring walks every node
      ...(fingers === 0 ? { ttl: () => MAX_TTL } : {}),

      leave() {
        if (pred && pred !== me) ctx.send(pred, "chord.leaving", { succ });
        if (!alone()) ctx.send(succ[0], "chord.leaving", { pred });
      },

      close() {
        for (const request of pending.values())
        {
          request.cancel();
          request.reject(new Error("closed"));
        }
        pending.clear();
      },

      known() {
        return [...new Set([pred, ...succ, ...finger])].filter((peer): peer is PeerId => !!peer && peer !== me);
      },
    };
  };
}
