import { BROADCAST, type Meta, type TopologyConfig } from "@papit/peer-message";
import { chord } from "./chord";
import { multicastTopology } from "./multicast";
import type { Topology, TopologyFactory, View } from "./types";

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

/** Topology factories by name: what a `TopologyConfig` (`NetworkInfo.topology`) resolves through. Add to it with `registerTopology`. */
export const topologies: Record<string, TopologyFactory> = {
  mesh: () => mesh,
  star: () => star,
  chord: () => chord,
  multicast: config => multicastTopology({ fanout: config.fanout as number | undefined }),
};

const builtIn = new Set(Object.keys(topologies));

/**
 * Adds a custom topology under `name`. Only its config is shared, never code, so every peer
 * must register the same factory under the same name.
 *
 * @throws {RangeError} for a built-in name (`mesh`, `star`, `chord`, `multicast`)
 */
export function registerTopology(name: string, factory: TopologyFactory) {
  if (builtIn.has(name)) throw new RangeError(`"${name}" is a built-in topology`);
  topologies[name] = factory;
}

/**
 * The topology a name or config describes. An unregistered name, or a factory that throws on the
 * config, falls back to `mesh` and reports the reason to `onError`. Deterministic, so every peer falls back alike.
 */
export function resolveTopology(topology: string | TopologyConfig, onError?: (error: Error) => void): Topology {
  const config = typeof topology === "string" ? { name: topology } : topology;
  try
  {
    const factory = Object.hasOwn(topologies, config.name) ? topologies[config.name] : null;
    if (!factory) throw new RangeError(`"${config.name}" is not a registered topology`);
    return factory(config);
  }
  catch (error)
  {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    return mesh;
  }
}
