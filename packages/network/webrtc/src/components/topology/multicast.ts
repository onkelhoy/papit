import { BROADCAST, type MediaPlan, type PeerId } from "@papit/peer-message";
import type { Topology, View } from "./types";

export type MulticastOptions = {
  /** Children per node. @default 3 */
  fanout?: number;
}

type Tree = { ids: PeerId[]; index: Map<PeerId, number> };

/**
 * A k-ary tree rooted at the host: host first, then the other members in sorted order. Node `i > 0`
 * has parent `⌊(i - 1) / k⌋` and children `k·i + 1 .. k·i + k`. Built for one-to-many media: each
 * node forwards streams to its children only, so no node uploads more than `fanout` copies.
 *
 * @throws {RangeError} when `fanout` isn't an integer >= 1
 */
export function multicastTopology({ fanout = 3 }: MulticastOptions = {}): Topology {
  if (!Number.isInteger(fanout) || fanout < 1) throw new RangeError(`multicast fanout must be an integer >= 1, got ${fanout}`);

  const trees = new WeakMap<readonly PeerId[], Map<PeerId, Tree | null>>();

  // null when the host isn't a member
  function tree(view: View): Tree | null {
    let byHost = trees.get(view.members);
    if (!byHost)
    {
      byHost = new Map();
      trees.set(view.members, byHost);
    }

    let cached = byHost.get(view.host);
    if (cached === undefined)
    {
      cached = null;
      if (view.members.includes(view.host))
      {
        const ids = [view.host, ...view.members.filter(id => id !== view.host)];
        cached = { ids, index: new Map(ids.map((id, i) => [id, i])) };
      }
      byHost.set(view.host, cached);
    }
    return cached;
  }

  const parentOf = (i: number) => i > 0 ? Math.floor((i - 1) / fanout) : -1;

  function children({ ids }: Tree, i: number) {
    return ids.slice(fanout * i + 1, fanout * i + fanout + 1);
  }

  function parent(view: View, id: PeerId) {
    const t = tree(view);
    const i = t?.index.get(id);
    if (!t || i === undefined || i === 0) return null;
    return t.ids[parentOf(i)];
  }

  function neighbors(view: View, id: PeerId) {
    const t = tree(view);
    const i = t?.index.get(id);
    if (!t || i === undefined) return [];

    const up = i > 0 ? [t.ids[parentOf(i)]] : [];
    return [...up, ...children(t, i)];
  }

  return {
    name: "multicast",
    neighbors,
    route(view, meta) {
      const t = tree(view);
      const me = t?.index.get(view.me);
      if (!t || me === undefined) return [];

      if (meta.receiver === BROADCAST)
      {
        const near = neighbors(view, view.me);
        return view.links.filter(link => !meta.hops.includes(link) && near.includes(link));
      }
      if (view.links.includes(meta.receiver)) return [meta.receiver];

      // walk up from the receiver: if we pass through me, go down the child we came from
      let i = t.index.get(meta.receiver);
      while (i !== undefined && i > me)
      {
        const up = parentOf(i);
        if (up === me) return view.links.includes(t.ids[i]) ? [t.ids[i]] : [];
        i = up;
      }

      const up = parent(view, view.me);
      return up && view.links.includes(up) ? [up] : [];
    },
    media(view, peer, plan): MediaPlan {
      if (parent(view, peer) === view.me) return plan;
      return { ...plan, streams: {} };
    },
    relay(view) {
      return parent(view, view.me);
    },
  };
}

/** Multicast tree with the default fanout of 3. */
export const multicast = multicastTopology();
