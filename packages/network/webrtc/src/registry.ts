import type { TopologyConfig } from "@papit/peer-message";
import { chordTopology } from "./topologies/chord";
import { meshTopology } from "./topologies/mesh";
import { starTopology } from "./topologies/star";
import { treeTopology } from "./topologies/tree";
import type { Topology, TopologyFactory } from "./types";

/** Names the built-in topologies own; `registerTopology` refuses them. */
const BUILT_IN = new Set(["mesh", "star", "multicast", "chord", "ring"]);

/** Topology factories by name: what a `TopologyConfig` (`NetworkInfo.topology`) resolves through. */
export const topologies: Record<string, TopologyFactory> = {
  mesh: () => meshTopology,
  star: () => starTopology,
  multicast: config => treeTopology(config),
  chord: config => chordTopology(config),
  ring: config => chordTopology({ ...config, fingers: 0 }),
};

/**
 * Adds a custom topology under `name`. Only its config is shared, never code, so every peer
 * registers the same factory under the same name.
 *
 * @throws {RangeError} for a built-in name
 */
export function registerTopology(name: string, factory: TopologyFactory) {
  if (BUILT_IN.has(name)) throw new RangeError(`"${name}" is a built-in topology`);
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
    return meshTopology;
  }
}

