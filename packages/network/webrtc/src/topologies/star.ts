import { BROADCAST, isKeyReceiver, MAX_ID_LENGTH } from "@papit/peer-message";
import type { Meta, PeerId } from "@papit/peer-message";

import type { Topology, TopologyContext, TopologyNode } from "../types";

/** Most members one `star.members` may list. */
const MAX_MEMBERS = 1024;

const isId = (x: unknown): x is PeerId => typeof x === "string" && x.length > 0 && x.length <= MAX_ID_LENGTH;
const isIds = (x: unknown, max: number): x is PeerId[] => Array.isArray(x) && x.length <= max && x.every(isId);
const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

export type StarApi = {
  readonly hub: PeerId | null;
  readonly members: readonly PeerId[];
};

/**
 * One hub links to every member and relays for them. The lowest non-hub member is the standby: it links
 * to everyone too, so it takes over as hub without new links when the hub dies.
 *
 * @fires leader - `CustomEvent<{ hub }>` on every hub change
 */
export const starTopology: Topology = (ctx: TopologyContext): TopologyNode<StarApi> => {
  let hub: PeerId | null = null;
  let members: PeerId[] = [];
  let standby: PeerId | null = null;
  let joined: (() => void) | null = null;
  /** A hub this hub folds under (merge), until the link to it opens. */
  let folding: PeerId | null = null;
  /** Waypoints to a new hub (merge): kept wanted until the hub link opens. */
  let through: PeerId[] = [];
  const wanted = new Set<PeerId>();

  const setHub = (next: PeerId) => {
    if (hub === next) return;
    hub = next;
    ctx.emit("leader", { hub });
  };

  const pickStandby = () => {
    standby = members.filter(peer => peer !== hub).sort()[0] ?? null;
  };

  /** Hub and standby want every member; a leaf wants the hub and the standby. */
  const sync = () => {
    const want = new Set<PeerId>();
    if (hub) want.add(hub);
    if (standby) want.add(standby);
    for (const peer of through) want.add(peer);
    if (hub === ctx.me || standby === ctx.me) for (const peer of members) want.add(peer);
    want.delete(ctx.me);

    for (const peer of want) ctx.connect(peer);
    for (const peer of wanted) if (!want.has(peer)) ctx.disconnect(peer);
    wanted.clear();
    for (const peer of want) wanted.add(peer);
  };

  /** The hub tells every link who's in. Unicast, so it never leaks across a merge bridge. */
  const announce = (except?: PeerId, via?: PeerId[]) => {
    for (const peer of ctx.links)
    {
      if (peer !== except) ctx.send(peer, "star.members", { hub, members, ...(via ? { via } : {}) });
    }
  };

  const becomeHub = () => {
    setHub(ctx.me);
    members = members.filter(peer => peer === ctx.me || ctx.links.has(peer));
    if (!members.includes(ctx.me)) members.push(ctx.me);
    pickStandby();
    sync();
    announce();
  };

  return {
    api: {
      get hub() { return hub; },
      get members() { return members; },
    },

    start(entry) {
      if (!entry)
      {
        setHub(ctx.me);
        members = [ctx.me];
        return;
      }
      return new Promise<void>(resolve => {
        joined = resolve;
        ctx.send(entry, "star.where", {});
      });
    },

    message(from, type, payload) {
      switch (type)
      {
        case "star.where":
          if (hub) ctx.send(from, "star.hub", { hub });
          return;

        case "star.hub": {
          if (!isObject(payload) || !isId(payload.hub)) return;
          const other = payload.hub;
          if (joined)
          {
            setHub(other);
            sync();
            if (ctx.links.has(other)) ctx.send(other, "star.join", {});
            return;
          }
          // a merge answer: the lower hub wins, the other side folds itself
          if (hub && other < hub)
          {
            const fold = { hub: other, via: [ctx.me, from] };
            if (hub === ctx.me) handleFold(fold.hub, fold.via);
            else ctx.send(hub, "star.fold", fold);
          }
          return;
        }

        case "star.members": {
          if (!isObject(payload) || !isId(payload.hub) || !isIds(payload.members, MAX_MEMBERS)) return;
          if (payload.via !== undefined && !isIds(payload.via, 8)) return;
          // I am the hub; nobody tells me who's in
          if (payload.hub === ctx.me) return;

          setHub(payload.hub);
          members = payload.members;
          pickStandby();
          const via = payload.via as PeerId[] | undefined;
          through = via && !ctx.links.has(payload.hub) ? via : [];
          if (through.length) ctx.connect(payload.hub, { via });
          sync();
          joined?.();
          joined = null;
          return;
        }

        case "star.join":
          // a member announces itself over its link; a bridge from another network never does
          if (hub !== ctx.me || !ctx.links.has(from)) return;
          if (!members.includes(from)) members.push(from);
          pickStandby();
          sync();
          announce();
          return;

        case "star.fold": {
          if (hub !== ctx.me || !isObject(payload) || !isId(payload.hub) || !isIds(payload.via, 8)) return;
          handleFold(payload.hub, payload.via);
          return;
        }
      }
    },

    link(peer, open) {
      if (open)
      {
        if (hub === ctx.me && peer === folding) return foldDone(peer);
        if (peer !== hub) return;
        ctx.send(hub, "star.join", {});
        if (through.length)
        {
          through = [];
          sync();
        }
        return;
      }

      if (hub === ctx.me)
      {
        if (!members.includes(peer)) return;
        members = members.filter(member => member !== peer);
        pickStandby();
        sync();
        announce();
        return;
      }

      if (peer !== hub) return;
      members = members.filter(member => member !== peer);
      const next = members.filter(member => member === ctx.me || ctx.links.has(member)).sort()[0];
      if (next === ctx.me) becomeHub();
      else if (next)
      {
        setHub(next);
        pickStandby();
        sync();
      }
    },

    route(meta: Meta) {
      if (meta.receiver === BROADCAST)
      {
        if (hub === ctx.me) return [...ctx.links].filter(peer => !meta.hops.includes(peer));
        return hub && ctx.links.has(hub) && !meta.hops.includes(hub) ? [hub] : [];
      }
      if (ctx.links.has(meta.receiver)) return [meta.receiver];
      return hub && hub !== ctx.me && ctx.links.has(hub) && !meta.hops.includes(hub) ? [hub] : [];
    },

    filter(meta: Meta) {
      if (isKeyReceiver(meta.receiver) && hub === ctx.me) return "deliver";
      return undefined;
    },

    owner() {
      return hub ? Promise.resolve(hub) : Promise.reject(new Error("no hub yet"));
    },

    merge(bridge) {
      ctx.send(bridge, "star.where", {});
    },

    known() {
      return members.filter(peer => peer !== ctx.me);
    },
  };

  /** My hub folds under the lower hub `other`: link to it through the bridge first. */
  function handleFold(other: PeerId, via: PeerId[]) {
    if (other === ctx.me || other >= ctx.me) return;
    folding = other;
    if (ctx.links.has(other)) return foldDone(other);
    ctx.connect(other, { via });
  }

  /** Linked to the new hub: send my members to it through me, then become its leaf. */
  function foldDone(other: PeerId) {
    folding = null;
    setHub(other);
    announce(other, [ctx.me]);
    ctx.send(other, "star.join", {});
    members = [other, ctx.me];
    pickStandby();
    sync();
  }
};
