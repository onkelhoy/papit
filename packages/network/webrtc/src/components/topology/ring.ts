import { BROADCAST, MAX_TTL, type PeerId } from "@papit/peer-message";
import type { Topology, View } from "./types";

const order = (view: View) => view.order ?? view.members;

/** The peers on either side of `id`: previous first, then next. Empty when `id` isn't a member or is alone. */
function around(view: View, id: PeerId) {
  const ids = order(view);
  const index = ids.indexOf(id);
  if (index < 0 || ids.length < 2) return [];
  return [...new Set([ids[(index - 1 + ids.length) % ids.length], ids[(index + 1) % ids.length]])];
}

/**
 * Every member links to the ones before and after it in the host's member list, closing a circle.
 * Newcomers go at the end, so a join moves one link and merging two rings only moves the two seams.
 * The cheapest topology to hold, the slowest to cross: a message takes up to half the ring.
 */
export const ring: Topology = {
  name: "ring",
  neighbors: around,
  stitch: around,
  route(view, meta) {
    const near = around(view, view.me);
    if (meta.receiver === BROADCAST) return view.links.filter(link => near.includes(link) && !meta.hops.includes(link));
    if (view.links.includes(meta.receiver)) return [meta.receiver];

    const ids = order(view);
    const me = ids.indexOf(view.me);
    const target = ids.indexOf(meta.receiver);
    if (me < 0 || target < 0) return [];

    // the short way round, the long way when that side has no link
    const ahead = (target - me + ids.length) % ids.length;
    const sides = [ids[(me + 1) % ids.length], ids[(me - 1 + ids.length) % ids.length]];
    if (ahead > ids.length / 2) sides.reverse();
    return sides.filter(side => view.links.includes(side) && !meta.hops.includes(side)).slice(0, 1);
  },
  // half the ring, whichever size it has: the default ttl stops at about 16 hops
  ttl: view => Math.min(MAX_TTL, Math.ceil(order(view).length / 2) + 2),
};
