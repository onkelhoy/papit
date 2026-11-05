import type { BROADCAST, MediaPlan, Message, Meta, NetworkInfo, NetworkType, PayloadMap, PeerId, Profile, RelayAction, TopologyConfig } from "@papit/peer-message";
import type { Network } from "./network";

/** All time goes through a clock, so tests can run a fake one. */
export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
};

/**
 * What a message arrived on: a link, the bootstrap (socket) or a parent network. Replies can go back on it.
 * `peer` is the remote node of a direct link; carriers that relay for others (a socket) have none.
 */
export type Carrier = {
  send(bytes: Uint8Array): boolean;
  readonly peer?: PeerId;
};

export type SendOptions = {
  /** Per-hop routing hint, read by the next node's topology. */
  hint?: string;
  /** Waypoints the message passes first (rule 5.0). */
  via?: PeerId[];
};

/** A next hop: a linked peer, or a linked peer with the `meta.hint` to set for that hop. */
export type Hop = PeerId | [PeerId, string];

/** What a topology sees of its node and how it acts. One per `Network`, scoped to it. */
export interface TopologyContext {
  readonly me: PeerId;
  readonly config: TopologyConfig;
  /** Open direct links of this network. Live: it changes as links open and close. */
  readonly links: ReadonlySet<PeerId>;
  /** I want a link to `peer`. Idempotent. `via`: signal through these waypoints. */
  connect(peer: PeerId, options?: { via?: PeerId[] }): void;
  /** I no longer want the link. It closes once neither side wants it. */
  disconnect(peer: PeerId): void;
  wants(peer: PeerId): boolean;
  /** Sends a `topology.<type>` message. */
  send(peer: PeerId | typeof BROADCAST, type: string, payload: unknown, options?: SendOptions): void;
  /** Passes a received topology message on to `peer`, keeping its sender. */
  forward(peer: PeerId, meta: Meta, options?: SendOptions): void;
  /** Round trip in ms over the direct link to `peer`. Rejects when not linked or after 5 s. */
  rtt(peer: PeerId): Promise<number>;
  /** Repeats `fn` every `ms`. Returns a cancel function; everything stops on close. */
  every(ms: number, fn: () => void): () => void;
  after(ms: number, fn: () => void): () => void;
  /** Dispatches `CustomEvent(type)` on the Network. */
  emit(type: string, detail?: unknown): void;
  random(): number;
  now(): number;
}

/** The functions a topology runs on each node. Only `start`, `message` and `route` are required. */
export interface TopologyNode<Api = unknown> {
  /** `null`: I created the network. Resolving means joined. */
  start(entry: PeerId | null): void | Promise<void>;
  /** On the entry, after admission and once the newcomer's link opened. */
  join?(peer: PeerId, profile?: Profile): void;
  /** Linked to a node of another part or network: absorb it. Must be idempotent. */
  merge?(bridge: PeerId): void | Promise<void>;
  /** A `topology.*` message for me, `type` without the prefix. Validate `payload` here. */
  message(from: PeerId, type: string, payload: unknown, meta: Meta): void;
  /** A link opened or closed. `left`: the peer sent `network.leave` first. */
  link?(peer: PeerId, open: boolean, left: boolean): void;
  /** Next hops for `meta`, drawn from the open links. */
  route(meta: Meta): Hop[];
  /** Who owns hash(key). Enables `sendKey`. */
  owner?(key: string): Promise<PeerId>;
  /** Graceful leave, before the network closes. */
  leave?(): void;
  close?(): void;
  /** What this node knows, never "the network". */
  known?(): readonly PeerId[];
  /** Good entry candidates for invites. */
  entries?(): PeerId[];
  /** Exposed as `network.topology`. */
  api?: Api;
  /** App messages must come straight from their sender. */
  readonly direct?: boolean;
  /** `ttl` for messages this node sends. */
  ttl?(): number;
  /** Overrides the relay decision; also decides delivery of key receivers. */
  filter?(meta: Meta): RelayAction | undefined;
  media?(peer: PeerId, plan: MediaPlan): MediaPlan;
  relay?(name: string): PeerId | null;
}

export type Topology = (ctx: TopologyContext) => TopologyNode;
/** Builds a topology from its shared config. Throw to reject the config. */
export type TopologyFactory = (config: TopologyConfig) => Topology;

/** What `create` registers. */
export type NetworkDraft = {
  name: string;
  topology: string | TopologyConfig;
  private?: boolean;
  password?: string;
  meta?: Record<string, unknown>;
  media?: MediaPlan;
  /** How many peers keep a socket to the registry. */
  anchors?: number;
  /** ms between anchor beacons, 0 = off. */
  beacon?: number;
};

export type JoinRequest = PayloadMap[NetworkType.Join];

/** What `network.update` may change. An empty `password` opens the network. */
export type NetworkUpdate = { name?: string; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan };

export type AnchorResult = { ok: boolean; existed: boolean; entry?: PeerId };

/**
 * How a network is found and first reached: a signal server, another network, memory.
 * Dispatches `"message"` as `CustomEvent<{ message: Message; carrier: Carrier }>` and `"anchors"` as
 * `CustomEvent<{ network: string; anchors: PeerId[]; target: number }>`.
 */
export interface Bootstrap extends EventTarget {
  readonly me: PeerId;
  /** True when the bootstrap (a registry) already checked join passwords; otherwise the entry checks them. */
  readonly checksPassword?: boolean;
  create(info: NetworkDraft, keyHash: string): Promise<NetworkInfo>;
  /** Sends `network.join` to an entry. Rejects when the network can't be found or reached. */
  join(network: string | NetworkInfo, request: JoinRequest): Promise<void>;
  /** First contact. False when `peer` can't be reached this way. */
  signal(peer: PeerId, bytes: Uint8Array): boolean;
  /** Optional: no anchor, no split healing. */
  anchor?(info: NetworkInfo, keyHash: string): Promise<AnchorResult>;
  unanchor?(network: string): void;
  /** Optional: changes the network at the registry, for an anchor. Resolves with the registry's info. */
  update?(network: string, changes: NetworkUpdate): Promise<NetworkInfo>;
  close(): void;
}

export type BootstrapMessage = { message: Message; carrier: Carrier };

/** Opens links. One per `Network`. Calls `network.attach(link)` with each link, and `network.fail(peer)` for an attempt that never got a link. */
export interface Connector {
  /** Signalling goes through `network.signal(peer, message, via)`. */
  connect(network: Network, peer: PeerId, via?: PeerId[]): void;
  /** A `handshake.*` message for me. */
  handle(network: Network, message: Message): void;
  cancel(peer: PeerId): void;
  close(): void;
}

export type EmitterEvent = {
  type: string;
  message: string;
  payload: any;
}
