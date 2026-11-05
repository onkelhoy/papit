import { BROADCAST, isKeyReceiver, MAX_ID_LENGTH } from "@papit/peer-message";
import type { MediaPlan, Meta, PeerId, TopologyConfig } from "@papit/peer-message";

import type { Topology, TopologyContext, TopologyNode } from "../types";

/** How long a parent holds a slot for a newcomer it placed. */
const RESERVE_MS = 10_000;
/** An orphan that got no `tree.parent` asks again after this. */
const RETRY_MS = 2_000;
const MAX_FANOUT = 64;

const isId = (x: unknown): x is PeerId => typeof x === "string" && x.length > 0 && x.length <= MAX_ID_LENGTH;
const isIds = (x: unknown, max: number): x is PeerId[] => Array.isArray(x) && x.length <= max && x.every(isId);
const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const isOptionalId = (x: unknown) => x === null || x === undefined || isId(x);

export type TreeApi = {
  readonly parent: PeerId | null;
  readonly children: readonly PeerId[];
  readonly root: PeerId | null;
};

/**
 * A multicast tree: each node has at most `fanout` children. A node links to its parent, its children and
 * its grandparent; the root's children also link each other, so an orphan reattaches without new signalling
 * paths. Built for one-to-many media: streams flow down from parent to child.
 *
 * @fires leader - `CustomEvent<{ root }>` on every root change
 * @throws {RangeError} when `fanout` isn't an integer in 1–64
 */
export function treeTopology(config: Partial<TopologyConfig> = {}): Topology {
  const fanout = config.fanout ?? 3;
  if (typeof fanout !== "number" || !Number.isInteger(fanout) || fanout < 1 || fanout > MAX_FANOUT)
  {
    throw new RangeError(`fanout must be an integer in 1–${MAX_FANOUT}`);
  }

  return (ctx: TopologyContext): TopologyNode<TreeApi> => {
    let parent: PeerId | null = null;
    let grand: PeerId | null = null;
    let root: PeerId | null = null;
    let children: PeerId[] = [];
    let siblings: PeerId[] = [];
    let next = 0;
    let joined: (() => void) | null = null;
    let retry: (() => void) | null = null;
    const reserved = new Map<PeerId, () => void>();
    const wanted = new Set<PeerId>();

    const setRoot = (id: PeerId) => {
      if (root === id) return;
      root = id;
      ctx.emit("leader", { root });
    };

    const sync = () => {
      const want = new Set<PeerId>(children);
      if (parent) want.add(parent);
      if (grand) want.add(grand);
      if (parent && parent === root) for (const peer of siblings) want.add(peer);
      want.delete(ctx.me);

      for (const peer of want) ctx.connect(peer);
      for (const peer of wanted) if (!want.has(peer)) ctx.disconnect(peer);
      wanted.clear();
      for (const peer of want) wanted.add(peer);
    };

    /** Every child hears its grandparent, siblings and the root. */
    const inform = () => {
      for (const child of children) ctx.send(child, "tree.info", { grand: parent, siblings: children.filter(peer => peer !== child), root });
    };

    /** Asks `to` for a place, again every RETRY_MS until a parent answers. */
    const place = (to: PeerId) => {
      retry?.();
      ctx.send(to, "tree.place", {});
      retry = ctx.after(RETRY_MS, () => {
        retry = null;
        if (parent || root === ctx.me) return;
        const target = [grand, root].find(peer => peer && peer !== ctx.me && ctx.links.has(peer));
        if (target) place(target);
      });
    };

    const handlePlace = (newcomer: PeerId, meta: Meta) => {
      if (newcomer === ctx.me || newcomer === parent) return;
      if (children.includes(newcomer) || reserved.has(newcomer) || children.length + reserved.size < fanout)
      {
        ctx.send(newcomer, "tree.parent", { parent: ctx.me, grand: parent, root });
        // linked already (the entry link): a child right away, else once its link opens
        if (ctx.links.has(newcomer)) adopt(newcomer);
        else if (!children.includes(newcomer) && !reserved.has(newcomer))
        {
          reserved.set(newcomer, ctx.after(RESERVE_MS, () => reserved.delete(newcomer)));
        }
        return;
      }
      const linked = children.filter(child => ctx.links.has(child));
      if (linked.length) ctx.forward(linked[next++ % linked.length], meta);
    };

    /** The root is gone: the lowest of its children takes over, the others hang under it. */
    const handleRootLost = () => {
      const heir = [ctx.me, ...siblings.filter(peer => ctx.links.has(peer))].sort()[0];
      parent = null;
      grand = null;
      if (heir === ctx.me)
      {
        setRoot(ctx.me);
        siblings = [];
        sync();
        inform();
        return;
      }
      // keep the sibling links: the heir is reached through one
      setRoot(heir);
      place(heir);
    };

    return {
      api: {
        get parent() { return parent; },
        get children() { return children; },
        get root() { return root; },
      },

      start(entry) {
        if (!entry)
        {
          setRoot(ctx.me);
          return;
        }
        return new Promise<void>(resolve => {
          joined = resolve;
          place(entry);
        });
      },

      message(from, type, payload, meta) {
        switch (type)
        {
          case "tree.place":
            handlePlace(meta.sender, meta);
            return;

          case "tree.parent": {
            if (!isObject(payload) || !isId(payload.parent) || !isOptionalId(payload.grand) || !isOptionalId(payload.root)) return;
            if (payload.parent === ctx.me || children.includes(payload.parent)) return;
            retry?.();
            retry = null;
            parent = payload.parent;
            grand = (payload.grand as PeerId | null | undefined) ?? null;
            if (grand === ctx.me) grand = null;
            setRoot((payload.root as PeerId | null | undefined) ?? parent);
            siblings = [];
            sync();
            inform();
            if (ctx.links.has(parent)) joinDone();
            return;
          }

          case "tree.info": {
            if (from !== parent || !isObject(payload) || !isOptionalId(payload.grand) || !isOptionalId(payload.root)) return;
            if (!isIds(payload.siblings, MAX_FANOUT)) return;
            const before = root;
            grand = (payload.grand as PeerId | null | undefined) ?? null;
            if (grand === ctx.me) grand = null;
            siblings = payload.siblings.filter(peer => peer !== ctx.me);
            if (payload.root) setRoot(payload.root as PeerId);
            sync();
            if (root !== before) inform();
            return;
          }

          case "tree.where":
            if (root) ctx.send(from, "tree.root", { root });
            return;

          case "tree.root": {
            if (!isObject(payload) || !isId(payload.root) || !root || payload.root >= root) return;
            // the lower root wins: my root hangs itself, and its whole subtree, under it
            const fold = { root: payload.root, via: [ctx.me, from] };
            if (root === ctx.me) handleFold(fold.root, fold.via);
            else ctx.send(root, "tree.fold", fold);
            return;
          }

          case "tree.fold": {
            if (root !== ctx.me || !isObject(payload) || !isId(payload.root) || !isIds(payload.via, 8)) return;
            handleFold(payload.root, payload.via);
            return;
          }
        }
      },

      link(peer, open) {
        if (open)
        {
          if (reserved.has(peer)) adopt(peer);
          if (peer === parent) joinDone();
          return;
        }

        reserved.get(peer)?.();
        reserved.delete(peer);
        if (children.includes(peer))
        {
          children = children.filter(child => child !== peer);
          sync();
          inform();
          return;
        }
        if (peer === parent)
        {
          if (grand)
          {
            parent = null;
            sync();
            place(grand);
          }
          else handleRootLost();
          return;
        }
        if (peer === grand) grand = null;
        siblings = siblings.filter(sibling => sibling !== peer);
      },

      route(meta: Meta) {
        // tree edges only: the path between two nodes is unique, so each node sees a message once
        const edges = [parent, ...children].filter((peer): peer is PeerId => !!peer && peer !== meta.sender && ctx.links.has(peer) && !meta.hops.includes(peer));
        if (meta.receiver === BROADCAST) return edges;
        if (isKeyReceiver(meta.receiver)) return parent && ctx.links.has(parent) ? [parent] : [];
        if (ctx.links.has(meta.receiver)) return [meta.receiver];
        return edges;
      },

      filter(meta: Meta) {
        if (isKeyReceiver(meta.receiver) && root === ctx.me) return "deliver";
        return undefined;
      },

      owner() {
        return root ? Promise.resolve(root) : Promise.reject(new Error("no root yet"));
      },

      merge(bridge) {
        ctx.send(bridge, "tree.where", {});
      },

      known() {
        return [...new Set([parent, grand, ...children, ...siblings])].filter((peer): peer is PeerId => !!peer && peer !== ctx.me);
      },

      media(peer: PeerId, plan: MediaPlan): MediaPlan {
        return children.includes(peer) ? plan : { ...plan, streams: {} };
      },

      relay() {
        return parent;
      },

      close() {
        retry?.();
        for (const cancel of reserved.values()) cancel();
        reserved.clear();
      },
    };

    function adopt(child: PeerId) {
      reserved.get(child)?.();
      reserved.delete(child);
      if (!children.includes(child)) children.push(child);
      sync();
      inform();
    }

    function joinDone() {
      joined?.();
      joined = null;
    }

    /** I'm the root and `other` is a lower one: ask its tree for a place, through the bridge. */
    function handleFold(other: PeerId, via: PeerId[]) {
      if (other === ctx.me) return;
      ctx.send(other, "tree.place", {}, { via });
    }
  };
}
