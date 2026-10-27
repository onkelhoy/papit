import type { NetworkInfo, PeerId } from "@papit/peer-message";
import type { Topology } from "../topology";

export type NetworkOptions = {
  /** This node's id. */
  me: PeerId;
  /** The network joined. Supplies the host, the id stamped on outgoing messages, and the topology by name. */
  info?: NetworkInfo;
  /** A topology or a name from `topologies`. Defaults to `info.topology`, then `mesh`. */
  topology?: Topology | string;
}
