/** `receiver` for messages meant for the signalling server. */
export const SERVER = "server";
/** `receiver` for messages meant for every peer in the network. */
export const BROADCAST = "*";
/** Relays a new message may take before it is dropped. */
export const DEFAULT_TTL = 16;
/** Largest `ttl` a message may carry. */
export const MAX_TTL = 255;
/** Largest encoded message `read` accepts by default. */
export const MAX_MESSAGE_BYTES = 256 * 1024;
/** Longest `id`, `type`, `sender`, `receiver`, `network` or hop entry. */
export const MAX_ID_LENGTH = 64;
/** Most entries `hops` may hold. With `MAX_TTL` a message can never exceed it. */
export const MAX_HOPS = 256;
/** `meta.type` prefixes owned by the protocol. Anything else is an app type. */
export const RESERVED_PREFIXES = ["signal.", "network.", "handshake.", "topology."] as const;
/** Largest serialized (UTF-8 JSON) profile. */
export const MAX_PROFILE_BYTES = 1024;
/** Largest serialized (UTF-8 JSON) topology config. */
export const MAX_TOPOLOGY_BYTES = 1024;
/** Most channels, and most streams, a media plan may hold. */
export const MAX_MEDIA_ENTRIES = 16;
/** Channel labels starting with this are internal (e.g. `_system`). */
export const RESERVED_CHANNEL_PREFIX = "_";
/** Type prefix of messages a topology sends; the engine only checks their size. */
export const TOPOLOGY_PREFIX = "topology.";
/** Largest serialized (UTF-8 JSON) payload of a `topology.*` message. */
export const MAX_TOPOLOGY_PAYLOAD_BYTES = 16 * 1024;
/** `receiver` prefix for a key receiver: `KEY_PREFIX` + the hex hash of an app key, routed by the topology. */
export const KEY_PREFIX = "@";
/** Most waypoints `meta.via` may hold. */
export const MAX_VIA = 8;
