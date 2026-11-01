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
    Merge = "signal.merge",
    Drain = "signal.drain",

    // server → client  (meta.receiver = socket id)
    Welcome = "signal.welcome",
    Registered = "signal.registered",
    Updated = "signal.updated",
    Networks = "signal.networks",
    Host = "signal.host",
    Drained = "signal.drained",
    Unreachable = "signal.unreachable",
    Error = "signal.error",
}

// peer ↔ peer, over any link
export enum NetworkType {
    Join = "network.join",
    Welcome = "network.welcome",
    Reject = "network.reject",
    Members = "network.members",
    Leave = "network.leave",
    Media = "network.media",
    Profile = "network.profile",
    Relay = "network.relay",
    Room = "network.room",
    Merge = "network.merge",
    MergeAccept = "network.merge-accept",
    MergeList = "network.merge-list",
    MergeView = "network.merge-view",
    Prune = "network.prune",
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
    host: PeerId;
    topology: string | TopologyConfig;
    private: boolean;
    size: number;
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
    [SignalType.Register]: { name: string; topology: string | TopologyConfig; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan };
    [SignalType.Update]: { network: string; name?: string; private?: boolean; password?: string; meta?: Record<string, unknown>; media?: MediaPlan };
    [SignalType.Unregister]: { network: string };
    [SignalType.List]: {};
    [SignalType.Join]: { network: string; password?: string; profile?: Profile };
    [SignalType.Leave]: { network: string };
    /**
     * Asks the host of `network` to merge with `from`, the network the sender hosts. `size` is the real
     * member count, the server's only counts sockets. `peer` is the sender's peer id, when it isn't its socket id.
     */
    [SignalType.Merge]: { network: string; from: string; size: number; password?: string; peer?: PeerId };
    /** Before closing a socket on purpose: with `draining` the server stops forwarding to it, without it the socket stays after all. */
    [SignalType.Drain]: { draining: boolean };
    /** Nothing more is on its way to this socket, so closing it loses nothing. */
    [SignalType.Drained]: {};
    [SignalType.Welcome]: { id: PeerId };
    [SignalType.Registered]: { network: NetworkInfo };
    [SignalType.Updated]: { network: NetworkInfo };
    [SignalType.Networks]: { networks: NetworkInfo[] };
    [SignalType.Host]: { network: NetworkInfo };
    [SignalType.Unreachable]: { receiver: PeerId; ref: string };
    [SignalType.Error]: { code: string; message: string; ref?: string };
    [NetworkType.Join]: { password?: string; profile?: Profile };
    [NetworkType.Welcome]: { network: NetworkInfo; members: PeerId[]; connect: PeerId[]; profiles?: Record<PeerId, Profile> };
    [NetworkType.Reject]: { reason: string };
    /** `serverId` is the id the server knows the network by, when the host registered it again. */
    [NetworkType.Members]: { members: PeerId[]; host?: PeerId; profiles?: Record<PeerId, Profile>; serverId?: string };
    [NetworkType.Leave]: { peer: PeerId };
    [NetworkType.Media]: { media: MediaPlan };
    [NetworkType.Profile]: { profile: Profile };
    /** A signalling message (base64 of its bytes) for the host to pass on through its socket. */
    [NetworkType.Relay]: { message: string };
    /** A message (base64 of its bytes) of a network opened over this one, for the receiver's `room`. */
    [NetworkType.Room]: { room: string; message: string };
    /** A host asks to merge, passed on by the server. The receiving host checks `password` and answers with `network.merge-accept` or `network.reject`. */
    [NetworkType.Merge]: { network: NetworkInfo; size: number; password?: string; peer?: PeerId };
    /** `peer` and `socket` are the accepting host's ids, the requester links to it through the server. */
    [NetworkType.MergeAccept]: { peer: PeerId; socket: PeerId; size: number };
    /** A host's network, sent to the other host over their link. `password` is what the staying network keeps. */
    [NetworkType.MergeList]: { network: NetworkInfo; members: PeerId[]; profiles?: Record<PeerId, Profile>; serverId?: string; password?: string };
    /** Everyone's new network: `network.host` is the host, `members` is both groups. Sent by a member's current host. */
    [NetworkType.MergeView]: { network: NetworkInfo; members: PeerId[]; profiles?: Record<PeerId, Profile>; serverId?: string; password?: string };
    /**
     * `streams` maps transceiver `mid` → media plan stream name, for the streams the offer carries.
     * `session` names the sender's connection: a new one means its end of the old link is gone.
     */
    /** Asks a linked peer to close a link neither side wants any more. Neither side is leaving. */
    [NetworkType.Prune]: {};
    [HandshakeType.Offer]: { description: SessionDescription; streams?: Record<string, string>; session?: string };
    [HandshakeType.Answer]: { description: SessionDescription; session?: string };
    [HandshakeType.Candidate]: { candidate: IceCandidate };
}

/** Payload of a reserved type; `unknown` for app types. */
export type PayloadOf<T extends string> = T extends keyof PayloadMap ? PayloadMap[T] : unknown;
