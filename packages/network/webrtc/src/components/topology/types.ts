import type { MediaPlan, Meta, PeerId, RelayAction } from "@papit/peer-message";

/** What a topology sees of a node. `members` is sorted and includes `me`; `links` are the open direct links. */
export type View = {
  me: PeerId;
  host: PeerId;
  members: readonly PeerId[];
  links: readonly PeerId[];
}

/**
 * The shape of a network: which links a node should hold and where it sends a message next.
 * Pure functions of the `View`, so the same topology runs on every node.
 */
export interface Topology {
  readonly name: string;
  /** The direct links `id` should hold, given `view.members`. */
  neighbors(view: View, id: PeerId): PeerId[];
  /** Next hops for `meta`, drawn from `view.links`. `[]` when there is no peer route. */
  route(view: View, meta: Meta): PeerId[];
  /**
   * Optional override for a received message, checked before `relay`. Return an action to replace
   * relay's decision (`"drop"`, `"deliver"`), or undefined to keep it. It can't force a forward past a loop or a spent `ttl`.
   */
  filter?(view: View, meta: Meta): RelayAction | undefined;
  /**
   * Optional: narrows the media plan for the direct link to `peer`. Only `streams` is used: channels
   * always follow the full plan, since both ends must agree on channel ids. A stream left out isn't sent
   * on this link (its transceiver goes `recvonly`). Defaults to the full plan.
   */
  media?(view: View, peer: PeerId, plan: MediaPlan): MediaPlan;
}
