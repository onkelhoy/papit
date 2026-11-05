import { Message } from "./component";
import { MAX_HOPS, MAX_ID_LENGTH, MAX_MEDIA_ENTRIES, KEY_PREFIX, MAX_MESSAGE_BYTES, MAX_PROFILE_BYTES, MAX_TOPOLOGY_BYTES, MAX_TOPOLOGY_PAYLOAD_BYTES, MAX_TTL, MAX_VIA, RESERVED_CHANNEL_PREFIX, RESERVED_PREFIXES, TOPOLOGY_PREFIX } from "./constants";
import { HandshakeType, MediaPlan, Meta, Profile, NetworkInfo, TopologyConfig, NetworkType, SignalType } from "./types";

type Obj = Record<string, unknown>;

const isObject = (x: unknown): x is Obj => x !== null && typeof x === "object" && !Array.isArray(x);
const isString = (x: unknown): x is string => typeof x === "string";
const isBoolean = (x: unknown): x is boolean => typeof x === "boolean";
const isId = (x: unknown, allowEmpty = false): x is string =>
    isString(x) && x.length <= MAX_ID_LENGTH && (allowEmpty || x.length > 0);
const isIds = (x: unknown): x is string[] => Array.isArray(x) && x.every(id => isId(id));
const isSize = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
const isPositive = (x: unknown) => Number.isInteger(x) && (x as number) >= 1;
const optional = (x: unknown, check: (x: unknown) => boolean) => x === undefined || check(x);

const encoder = new TextEncoder();

const fits = (x: unknown, maxBytes: number) => {
    try
    {
        return encoder.encode(JSON.stringify(x)).byteLength <= maxBytes;
    }
    catch
    {
        return false;
    }
};

/** Checks an untrusted profile: a JSON object of at most `MAX_PROFILE_BYTES` UTF-8 bytes. */
export function isProfile(x: unknown): x is Profile {
    return isObject(x) && fits(x, MAX_PROFILE_BYTES);
}

/**
 * Checks an untrusted topology: a name of 1..`MAX_ID_LENGTH` characters, or a JSON object with such a
 * `name` of at most `MAX_TOPOLOGY_BYTES` UTF-8 bytes.
 */
export function isTopology(x: unknown): x is string | TopologyConfig {
    if (isString(x)) return isId(x);
    return isObject(x) && isId(x.name) && fits(x, MAX_TOPOLOGY_BYTES);
}


const isCount = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;

function isChannelInit(x: unknown) {
    return isObject(x)
        && x.negotiated === undefined && x.id === undefined
        && optional(x.ordered, isBoolean)
        && optional(x.maxRetransmits, isCount)
        && optional(x.maxPacketLifeTime, isCount)
        && (x.maxRetransmits === undefined || x.maxPacketLifeTime === undefined)
        && optional(x.protocol, isString);
}

const isStream = (x: unknown) => isObject(x) && (x.kind === "audio" || x.kind === "video");

function isEntries(x: unknown, check: (name: string, value: unknown) => boolean) {
    if (!isObject(x)) return false;
    const entries = Object.entries(x);
    return entries.length <= MAX_MEDIA_ENTRIES && entries.every(([name, value]) => isId(name) && check(name, value));
}

/**
 * Checks an untrusted media plan: at most `MAX_MEDIA_ENTRIES` channels and streams, labels and names
 * 1..`MAX_ID_LENGTH` characters, no channel label starting with `_`, valid `ChannelInit` fields
 * (no `negotiated`/`id`, not both retransmit limits) and a stream `kind` of audio or video.
 */
export function isMediaPlan(x: unknown): x is MediaPlan {
    return isObject(x)
        && optional(x.channels, c => isEntries(c, (label, init) => !label.startsWith(RESERVED_CHANNEL_PREFIX) && isChannelInit(init)))
        && optional(x.streams, s => isEntries(s, (_, stream) => isStream(stream)));
}

function isNetworkInfo(x: unknown): x is NetworkInfo {
    return isObject(x)
        && isId(x.id)
        && isString(x.name)
        && isTopology(x.topology)
        && isBoolean(x.private)
        && Number.isInteger(x.size) && (x.size as number) >= 0
        && optional(x.anchors, isPositive)
        && optional(x.beacon, isSize)
        && optional(x.entries, isIds)
        && optional(x.meta, isObject)
        && optional(x.media, isMediaPlan);
}

// mid → stream name; a link's transceivers outlive plan changes, so allow more than MAX_MEDIA_ENTRIES
const isStreamMap = (x: unknown) => isObject(x)
    && Object.keys(x).length <= MAX_MEDIA_ENTRIES * 4
    && Object.entries(x).every(([mid, name]) => isId(mid) && isId(name));

const isDescription = (x: unknown) => isObject(x) && isString(x.type) && optional(x.sdp, isString);
const isCandidate = (x: unknown) => isObject(x)
    && optional(x.candidate, isString)
    && optional(x.sdpMid, v => v === null || isString(v))
    && optional(x.sdpMLineIndex, v => v === null || Number.isInteger(v))
    && optional(x.usernameFragment, v => v === null || isString(v));

const isMerge = (x: unknown) => isObject(x) && isNetworkInfo(x.network) && isTopology(x.topology) && optional(x.keyHash, isId);


const payloads = new Map<string, (p: Obj) => boolean>([
    [SignalType.Register, p => isString(p.name) && isTopology(p.topology) && optional(p.private, isBoolean) && optional(p.password, isString) && optional(p.meta, isObject) && optional(p.media, isMediaPlan) && optional(p.anchors, isPositive) && optional(p.keyHash, isId)],
    [SignalType.Update, p => isId(p.network) && optional(p.name, isString) && optional(p.private, isBoolean) && optional(p.password, isString) && optional(p.meta, isObject) && optional(p.media, isMediaPlan)],
    [SignalType.Unregister, p => isId(p.network)],
    [SignalType.List, () => true],
    [SignalType.Join, p => isId(p.network) && optional(p.password, isString) && optional(p.profile, isProfile) && optional(p.merge, isMerge)],
    [SignalType.Leave, p => isId(p.network)],
    [SignalType.Drain, p => isBoolean(p.draining)],
    [SignalType.Drained, () => true],
    [SignalType.Anchor, p => isNetworkInfo(p.network) && isId(p.keyHash) && isId(p.peer)],
    [SignalType.Anchored, p => isId(p.network) && isBoolean(p.ok) && isBoolean(p.existed) && optional(p.entry, isId)],
    [SignalType.Unanchor, p => isId(p.network)],
    [SignalType.Anchors, p => isId(p.network) && isIds(p.anchors) && isSize(p.target)],
    [SignalType.Welcome, p => isId(p.id) && optional(p.token, isId)],
    [SignalType.Resume, p => isId(p.peer) && optional(p.token, isId)],
    [SignalType.Resumed, p => isId(p.peer)],
    [SignalType.Registered, p => isNetworkInfo(p.network)],
    [SignalType.Updated, p => isNetworkInfo(p.network)],
    [SignalType.Networks, p => Array.isArray(p.networks) && p.networks.every(isNetworkInfo)],
    [SignalType.Unreachable, p => isId(p.receiver) && isId(p.ref)],
    [SignalType.Error, p => isString(p.code) && isString(p.message) && optional(p.ref, isId)],
    [NetworkType.Join, p => optional(p.password, isString) && optional(p.profile, isProfile) && optional(p.merge, isMerge)],
    [NetworkType.Reject, p => isString(p.reason)],
    [NetworkType.Leave, p => isId(p.peer)],
    [NetworkType.Media, p => isMediaPlan(p.media)],
    [NetworkType.Room, p => isId(p.room) && isString(p.message)],
    [NetworkType.Prune, () => true],
    [NetworkType.Admit, p => isNetworkInfo(p.network) && isId(p.key) && isBoolean(p.merge)],
    [NetworkType.Adopt, p => isNetworkInfo(p.network) && isId(p.key)],
    [NetworkType.Anchor, () => true],
    [NetworkType.Beacon, p => isSize(p.anchors)],
    [NetworkType.Ping, p => isSize(p.n)],
    [NetworkType.Pong, p => isSize(p.n)],
    [HandshakeType.Offer, p => isDescription(p.description) && optional(p.streams, isStreamMap) && optional(p.session, isString)],
    [HandshakeType.Answer, p => isDescription(p.description) && optional(p.session, isString)],
    [HandshakeType.Candidate, p => isCandidate(p.candidate)],
]);

/** True when `type` starts with a protocol prefix (`signal.`, `network.`, `handshake.`, `topology.`). */
export function isReserved(type: string) {
    return RESERVED_PREFIXES.some(prefix => type.startsWith(prefix));
}

/** True for a key receiver: `KEY_PREFIX` + a hex hash, at most `MAX_ID_LENGTH` characters. */
export function isKeyReceiver(id: unknown): id is string {
    return isId(id) && id.startsWith(KEY_PREFIX) && /^[0-9a-f]+$/.test(id.slice(KEY_PREFIX.length));
}

/**
 * Checks an untrusted meta: every field's type, ids (and `type`) at most `MAX_ID_LENGTH` characters,
 * `ttl` an integer in 0..`MAX_TTL`, a finite `timestamp`, at most `MAX_HOPS` hops.
 */
export function isMeta(x: unknown): x is Meta {
    return isObject(x)
        && isId(x.id)
        && isId(x.type)
        && isId(x.sender, true)
        && isId(x.receiver)
        && optional(x.network, isId)
        && typeof x.timestamp === "number" && Number.isFinite(x.timestamp)
        && Number.isInteger(x.ttl) && (x.ttl as number) >= 0 && (x.ttl as number) <= MAX_TTL
        && isIds(x.hops) && x.hops.length <= MAX_HOPS
        && optional(x.hint, isId)
        && optional(x.via, v => isIds(v) && v.length <= MAX_VIA);
}

/** Checks an untrusted, already parsed payload against the shape of a reserved `type`. False for unknown types. */
export function isPayload(type: string, x: unknown) {
    if (type.startsWith(TOPOLOGY_PREFIX)) return x !== undefined && fits(x, MAX_TOPOLOGY_PAYLOAD_BYTES);
    const check = payloads.get(type);
    return !!check && isObject(x) && check(x);
}

/**
 * Decodes and validates a message from the wire. Never throws.
 * Returns null when the input is not binary, larger than `maxBytes`, not decodable, has a bad meta,
 * or is a reserved type with a bad payload. Only reserved payloads are parsed; app payloads stay bytes.
 */
export function read(bytes: ArrayBuffer | ArrayBufferView, maxBytes = MAX_MESSAGE_BYTES): Message | null {
    let data: Uint8Array;
    if (bytes instanceof Uint8Array) data = bytes;
    else if (bytes instanceof ArrayBuffer) data = new Uint8Array(bytes);
    else if (ArrayBuffer.isView(bytes)) data = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    else return null;

    if (data.byteLength > maxBytes) return null;

    try
    {
        const message = Message.FromBinary(data, false);
        if (!isMeta(message.meta)) return null;
        if (isReserved(message.meta.type) && !isPayload(message.meta.type, message.parse())) return null;

        return message;
    }
    catch
    {
        return null;
    }
}
