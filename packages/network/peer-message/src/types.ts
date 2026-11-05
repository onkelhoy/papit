export type PeerId = string;

/**
 * Routing header of every peer message.
 * `ttl` is the number of relays left; `hops` lists every node that handled the message, sender first.
 */
export type Meta<Type extends string = string> = {
    id: string;
    type: Type;
    sender: PeerId;
    receiver: PeerId;  // peer id | SERVER | BROADCAST
    network?: string;
    timestamp: number;
    ttl: number;
    hops: PeerId[];
    /** Per-hop routing hint a topology sets and reads, e.g. the chord broadcast limit. */
    hint?: string;
    /** Waypoints: the message goes to `via[0]` first, which removes itself and continues. At most `MAX_VIA`. */
    via?: PeerId[];
}

/** What a node does with a message it received, see `relay`. */
export type RelayAction = "deliver" | "forward" | "both" | "drop";

export enum SignalType {
    // client → server  (meta.receiver = SERVER)
    Register = "signal.register",
    Update = "signal.update",
    Unregister = "signal.unregister",
    List = "signal.list",
    Join = "signal.join",
    Leave = "signal.leave",
    Drain = "signal.drain",
    Anchor = "signal.anchor",
    Unanchor = "signal.unanchor",

    // server → client  (meta.receiver = socket id)
    Welcome = "signal.welcome",
    Registered = "signal.registered",
    Updated = "signal.updated",
    Networks = "signal.networks",
    Drained = "signal.drained",
    Anchored = "signal.anchored",
    Anchors = "signal.anchors",
    Unreachable = "signal.unreachable",
    Error = "signal.error",
}

// peer ↔ peer, over any link
export enum NetworkType {
    Join = "network.join",
    Reject = "network.reject",
    Leave = "network.leave",
    Media = "network.media",
    Room = "network.room",
    Prune = "network.prune",
    Admit = "network.admit",
    Adopt = "network.adopt",
    Anchor = "network.anchor",
    Beacon = "network.beacon",
    Ping = "network.ping",
    Pong = "network.pong",
}

// peer ↔ peer, over any link
export enum HandshakeType {
    Offer = "handshake.offer",
    Answer = "handshake.answer",
    Candidate = "handshake.candidate",
}

export type ReservedType = SignalType | NetworkType | HandshakeType;

export type NetworkInfo = {
    id: string;
    name: string;
    topology: string | TopologyConfig;
    private: boolean;
    size: number;
    /** How many peers keep a socket to the registry. */
    anchors?: number;
    /** ms between anchor beacons, 0 = off. */
    beacon?: number;
    /** Peers a joiner may enter through. */
    entries?: PeerId[];
    meta?: Record<string, unknown>;
    media?: MediaPlan;
}

/** Structural subset of `RTCDataChannelInit`. `negotiated` and `id` are assigned by the peers. */
export type ChannelInit = {
    ordered?: boolean;
    maxRetransmits?: number;
    maxPacketLifeTime?: number;
    protocol?: string;
}

export type StreamKind = "audio" | "video";

/**
 * A shareable topology: a registered name plus JSON options for its factory, e.g. `{ name: "multicast", fanout: 5 }`.
 * At most `MAX_TOPOLOGY_BYTES` serialized. Only config travels; every peer registers the code itself.
 */
export type TopologyConfig = { name: string } & Record<string, unknown>;

/** What a peer says about itself, e.g. `{ name }`. JSON, at most `MAX_PROFILE_BYTES` serialized. */
export type Profile = Record<string, unknown>;

/**
 * The data channels and media streams every link in a network carries, by label / name.
 * Channel labels starting with `_` are reserved.
 */
export type MediaPlan = {
    channels?: Record<string, ChannelInit>;
    streams?: Record<string, { kind: StreamKind }>;
}

/** Structural stand-in for `RTCSessionDescriptionInit`, so node can compile it. */
export type SessionDescription = {
    type: string;
    sdp?: string;
}

/** Structural stand-in for `RTCIceCandidateInit`, so node can compile it. */
export type IceCandidate = {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
}

/** Payload shape per reserved `meta.type`. */
export type PayloadMap = {
    [SignalType.Register]: { name: string; topology: string | TopologyConfig; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan; anchors?: number; keyHash?: string };
    [SignalType.Update]: { network: string; name?: string; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan };
    [SignalType.Unregister]: { network: string };
    [SignalType.List]: {};
    /** `merge`: the sender's network merges into this one; a `keyHash` that matches heals a split without the password. */
    [SignalType.Join]: { network: string; password?: string; profile?: Profile; merge?: { network: NetworkInfo; topology: string | TopologyConfig; keyHash?: string } };
    [SignalType.Leave]: { network: string };
    /** Before closing a socket on purpose: with `draining` the server stops forwarding to it, without it the socket stays after all. */
    [SignalType.Drain]: { draining: boolean };
    /** Nothing more is on its way to this socket, so closing it loses nothing. */
    [SignalType.Drained]: {};
    /** Become an anchor of `network`, or have the registry re-create it when it forgot it. `keyHash` proves membership. */
    [SignalType.Anchor]: { network: NetworkInfo; keyHash: string; peer: PeerId };
    /** `existed` with `entry` (the lowest anchor) means the caller should merge through `entry`. */
    [SignalType.Anchored]: { network: string; ok: boolean; existed: boolean; entry?: PeerId };
    [SignalType.Unanchor]: { network: string };
    /** Registry → anchors, on each change of the anchor set. */
    [SignalType.Anchors]: { network: string; anchors: PeerId[]; target: number };
    [SignalType.Welcome]: { id: PeerId };
    [SignalType.Registered]: { network: NetworkInfo };
    [SignalType.Updated]: { network: NetworkInfo };
    [SignalType.Networks]: { networks: NetworkInfo[] };
    [SignalType.Unreachable]: { receiver: PeerId; ref: string };
    [SignalType.Error]: { code: string; message: string; ref?: string };
    /** `merge` makes the join a merge: the sender's network asks to be folded into the receiver's. */
    [NetworkType.Join]: { password?: string; profile?: Profile; merge?: { network: NetworkInfo; topology: string | TopologyConfig; keyHash?: string } };
    [NetworkType.Reject]: { reason: string };
    [NetworkType.Leave]: { peer: PeerId };
    [NetworkType.Media]: { media: MediaPlan };
    /** A message (base64 of its bytes) of a network opened over this one, for the receiver's `room`. */
    [NetworkType.Room]: { room: string; message: string };
    /** Asks a linked peer to close a link neither side wants any more. Neither side is leaving. */
    [NetworkType.Prune]: {};
    /** A join was admitted. `key` is the network key, `merge` tells the join was a merge. */
    [NetworkType.Admit]: { network: NetworkInfo; key: string; merge: boolean };
    /** Broadcast after a merge: switch to this network's identity. */
    [NetworkType.Adopt]: { network: NetworkInfo; key: string };
    /** An anchor recruits a linked peer to become an anchor too. */
    [NetworkType.Anchor]: {};
    /** The lowest anchor's heartbeat. */
    [NetworkType.Beacon]: { anchors: number };
    /** Round-trip measurement, link level only. */
    [NetworkType.Ping]: { n: number };
    [NetworkType.Pong]: { n: number };
    /**
     * `streams` maps transceiver `mid` → media plan stream name, for the streams the offer carries.
     * `session` names the sender's connection: a new one means its end of the old link is gone.
     */
    [HandshakeType.Offer]: { description: SessionDescription; streams?: Record<string, string>; session?: string };
    [HandshakeType.Answer]: { description: SessionDescription; session?: string };
    [HandshakeType.Candidate]: { candidate: IceCandidate };
}

/** Payload of a reserved type; `unknown` for app types. */
export type PayloadOf<T extends string> = T extends keyof PayloadMap ? PayloadMap[T] : unknown;
