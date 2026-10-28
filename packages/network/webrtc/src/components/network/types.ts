import type { NetworkInfo, PeerId, TopologyConfig } from "@papit/peer-message";
import type { Topology } from "../topology";

export type NetworkOptions = {
  /** This node's id. */
  me: PeerId;
  /** The network joined. Supplies the host, the id stamped on outgoing messages, and the topology by name. */
  info?: NetworkInfo;
  /** A resolved topology, or a name / config resolved through `topologies`. Defaults to `info.topology`, then `mesh`. */
  topology?: Topology | string | TopologyConfig;
}
