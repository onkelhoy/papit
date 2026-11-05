import { BROADCAST, isKeyReceiver, KEY_PREFIX, MAX_ID_LENGTH } from "@papit/peer-message";
import type { Meta, PeerId } from "@papit/peer-message";

import { fnv1a, keyHash } from "../hash";
import type { Topology, TopologyContext, TopologyNode } from "../types";

/** Most peers one `mesh.peers` may list. */
const MAX_PEERS = 256;
const RING = 2 ** 32;

const isPeers = (x: unknown): x is PeerId[] => Array.isArray(x) && x.length <= MAX_PEERS
  && x.every(id => typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH);
const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

/**
 * Everyone links to everyone. A newcomer asks its entry for its links and connects to each.
 * Merging introduces both sides to each other across the bridge.
 */
export const meshTopology: Topology = (ctx: TopologyContext): TopologyNode => {
  let joined: (() => void) | null = null;

  const others = (peers: PeerId[]) => peers.filter(peer => peer !== ctx.me && !ctx.links.has(peer));

  /** Everyone knows everyone, so they all agree: the first id hash at or after the key's. */
  const ownerOf = (hash: number) => {
    let best = ctx.me;
    let gap = Infinity;
    for (const id of [ctx.me, ...ctx.links])
    {
      const distance = (fnv1a(id) - hash + RING) % RING;
      if (distance < gap || (distance === gap && id < best))
      {
        best = id;
        gap = distance;
      }
    }
    return best;
  };
  const keyOwner = (receiver: string) => ownerOf(parseInt(receiver.slice(KEY_PREFIX.length), 16));

  return {
    direct: true,

    start(entry) {
      if (!entry) return;
      return new Promise<void>(resolve => {
        joined = resolve;
        ctx.send(entry, "mesh.hello", {});
      });
    },

    message(from, type, payload) {
      switch (type)
      {
        case "mesh.hello":
          ctx.send(from, "mesh.peers", { peers: [...ctx.links].filter(peer => peer !== from) });
          return;

        case "mesh.peers": {
          if (!isObject(payload) || !isPeers(payload.peers) || (payload.via !== undefined && !isPeers(payload.via))) return;
          // without waypoints, through whoever told me: it's linked to them all, and the socket may be gone
          const via = (payload.via as PeerId[] | undefined) ?? [from];
          for (const peer of others(payload.peers)) ctx.connect(peer, { via });
          joined?.();
          joined = null;
          return;
        }

        case "mesh.cross": {
          if (!isObject(payload) || !isPeers(payload.peers)) return;
          // my side meets the other side through me and the bridge
          ctx.send(BROADCAST, "mesh.peers", { peers: payload.peers, via: [ctx.me, from] });
          for (const peer of others(payload.peers)) ctx.connect(peer, { via: [from] });
          return;
        }
      }
    },

    link(peer, open) {
      if (open) ctx.connect(peer);
      else ctx.disconnect(peer);
    },

    route(meta: Meta) {
      if (meta.receiver === BROADCAST) return [...ctx.links].filter(peer => !meta.hops.includes(peer));
      const target = isKeyReceiver(meta.receiver) ? keyOwner(meta.receiver) : meta.receiver;
      return ctx.links.has(target) ? [target] : [];
    },

    filter(meta: Meta) {
      if (isKeyReceiver(meta.receiver) && keyOwner(meta.receiver) === ctx.me) return "deliver";
      return undefined;
    },

    owner(key) {
      return Promise.resolve(ownerOf(keyHash(key)));
    },

    merge(bridge) {
      ctx.send(bridge, "mesh.cross", { peers: [...ctx.links, ctx.me] });
    },

    known() {
      return [...ctx.links];
    },
  };
};
