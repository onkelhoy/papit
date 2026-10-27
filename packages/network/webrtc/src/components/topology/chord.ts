import { BROADCAST, type PeerId } from "@papit/peer-message";
import type { Topology, View } from "./types";

const RING = 2 ** 32;

/** FNV-1a 32-bit hash of `id`'s UTF-16 code units: its position on the chord ring. */
export function fnv1a(id: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++)
  {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Clockwise distance from `a` to `b` on the ring. */
const distance = (a: number, b: number) => (b - a + RING) % RING;

type Ring = { ids: PeerId[]; hashes: number[] };
const rings = new WeakMap<readonly PeerId[], Ring>();

function ring(members: readonly PeerId[]): Ring {
  let cached = rings.get(members);
  if (!cached)
  {
    const sorted = members.map(id => ({ id, hash: fnv1a(id) })).sort((a, b) => a.hash - b.hash || (a.id < b.id ? -1 : 1));
    cached = { ids: sorted.map(n => n.id), hashes: sorted.map(n => n.hash) };
    rings.set(members, cached);
  }
  return cached;
}

/** The first member at or clockwise after `point`. */
function successor({ ids, hashes }: Ring, point: number) {
  let low = 0;
  let high = hashes.length;
  while (low < high)
  {
    const mid = (low + high) >> 1;
    if (hashes[mid] < point) low = mid + 1;
    else high = mid;
  }
  return ids[low % ids.length];
}

/**
 * Chord ring: ids hash onto 2^32 positions; each node links to its predecessor, its successor and
 * the successor of `hash + 2^i` for i = 0..31 (its fingers). Lookups take O(log n) hops.
 */
export const chord: Topology = {
  name: "chord",
  neighbors(view: View, id: PeerId) {
    const r = ring(view.members);
    if (r.ids.length < 2) return [];

    const hash = fnv1a(id);
    const index = r.ids.indexOf(id);
    const wanted = new Set<PeerId>();
    if (index >= 0) wanted.add(r.ids[(index - 1 + r.ids.length) % r.ids.length]);
    for (let i = 0; i < 32; i++)
    {
      wanted.add(successor(r, (hash + 2 ** i) % RING));
    }

    wanted.delete(id);
    return [...wanted];
  },
  route(view: View, meta) {
    if (meta.receiver === BROADCAST) return view.links.filter(link => !meta.hops.includes(link));
    if (view.links.includes(meta.receiver)) return [meta.receiver];
    if (view.links.length === 0) return [];

    const me = fnv1a(view.me);
    const target = distance(me, fnv1a(meta.receiver));

    // closest preceding link: furthest along the ring from me without passing the receiver
    let best: PeerId | null = null;
    let bestDistance = -1;
    let next: PeerId = view.links[0];
    let nextDistance = RING;
    for (const link of view.links)
    {
      const d = distance(me, fnv1a(link));
      if (d < target && d > bestDistance)
      {
        best = link;
        bestDistance = d;
      }
      if (d > 0 && d < nextDistance)
      {
        next = link;
        nextDistance = d;
      }
    }

    return [best ?? next];
  },
};
