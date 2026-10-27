import { BROADCAST, type Meta } from "@papit/peer-message";
import { chord } from "./chord";
import type { Topology, View } from "./types";

const others = (view: View, id: string) => view.members.filter(member => member !== id);
const unvisited = (view: View, meta: Meta) => view.links.filter(link => !meta.hops.includes(link));
const linked = (view: View, id: string) => view.links.includes(id) ? [id] : [];

/** Every member links to every other. Messages go straight to the receiver. */
export const mesh: Topology = {
  name: "mesh",
  neighbors: others,
  route(view, meta) {
    if (meta.receiver === BROADCAST) return unvisited(view, meta);
    return linked(view, meta.receiver);
  },
};

/** Every member links to the host (the hub), which relays between leaves. */
export const star: Topology = {
  name: "star",
  neighbors(view, id) {
    if (id === view.host) return others(view, id);
    return view.members.includes(view.host) ? [view.host] : [];
  },
  route(view, meta) {
    const hub = view.host;
    if (view.me === hub)
    {
      if (meta.receiver === BROADCAST) return unvisited(view, meta);
      return linked(view, meta.receiver);
    }

    if (meta.receiver === BROADCAST && meta.hops.includes(hub)) return [];
    return linked(view, hub);
  },
};

/** Built-in topologies by name, the value of `NetworkInfo.topology`. */
export const topologies: Record<string, Topology> = { mesh, star, chord };
