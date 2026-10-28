# @papit/peer-message

Shared message format and signalling protocol for @papit/webrtc and @papit/signal-server, built on @papit/meta-json. Reach for it to create, validate and relay peer messages in node or the browser.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-network-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/peer-message.svg?logo=npm)](https://www.npmjs.com/package/@papit/peer-message)

---

# Installation

```bash
npm install @papit/peer-message
```

Runs in node (>= 18) and the browser. Its only dependency is `@papit/meta-json`.

# Usage

```js
import { Message, SignalType } from "@papit/peer-message";

const join = Message.Create({ type: SignalType.Join }, { network: "n1" });
socket.send(join.toBinary()); // receiver defaults to SERVER
```

Receiving, deduping and relaying:

```js
import { read, relay, Seen } from "@papit/peer-message";

const seen = new Seen();

channel.onmessage = ({ data }) => {
    const message = read(data);               // null for anything malformed
    if (!message || !seen.check(message.meta.id)) return;

    switch (relay(message.meta, me))
    {
        case "deliver": handle(message); break;
        case "forward": send(message.toBinary(true)); break;
        case "both": handle(message); send(message.toBinary(true)); break;
        // "drop": loop or ttl spent
    }
};
```

App messages use any `type` outside the reserved prefixes. Their payload is left as bytes until you call `parse()`:

```js
import { Message, BROADCAST } from "@papit/peer-message";

const chat = Message.Create({ type: "chat", sender: me, receiver: BROADCAST, network: "n1" }, JSON.stringify({ text: "hej" }));
```

# API

## Message

```ts
class Message<Type extends string = string, Payload = any> extends MetaJson<Meta<Type>, Payload> {
    static Create(meta: Partial<Meta<Type>> & { type: Type }, payload): Message;
}
```

Payloads are JSON. An object (or an already parsed payload) is `JSON.stringify`d on encode, a string is taken as already encoded, and binary is copied as-is. Everything else (`toBinary`, `parse`, `FromBinary`) comes from [`MetaJson`](https://github.com/onkelhoy/papit/tree/main/packages/network/meta-json). `Create` fills in every meta field not given:

| Field | Default |
| --- | --- |
| `id` | `crypto.randomUUID()`, or a time + counter + random id where `crypto` is missing (node 18) |
| `sender` | `""` |
| `receiver` | `SERVER` |
| `timestamp` | `Date.now()` |
| `ttl` | `DEFAULT_TTL` |
| `hops` | `[sender]`, or `[]` without a sender |

## relay

```ts
function relay(meta: Meta, me: PeerId): "deliver" | "forward" | "both" | "drop";
```

Call once on every message a node **receives**. It mutates `meta` (see [Relay rules](#relay-rules)).

## Seen

```ts
class Seen {
    constructor(limit = 1024);
    check(id: string): boolean;
}
```

Bounded set of message ids. `check` is true the first time an id is seen and false for duplicates. Past `limit` the oldest id is forgotten. Use it to dedupe broadcasts.

## Guards

For untrusted input. None of them throw.

| Function | Purpose |
| --- | --- |
| `read(bytes, maxBytes = MAX_MESSAGE_BYTES)` | Decode and validate a `Uint8Array`, `ArrayBuffer` or other view. Returns a `Message`, or `null` when the input is too big, can't be decoded, has a bad meta, or is a reserved type with a bad payload. |
| `isMeta(x)` | Shape and limits of a `Meta`. |
| `isProfile(x)` | A JSON object of at most `MAX_PROFILE_BYTES` UTF-8 bytes. |
| `isTopology(x)` | A topology name of 1..`MAX_ID_LENGTH` characters, or a `TopologyConfig` with such a `name` of at most `MAX_TOPOLOGY_BYTES` UTF-8 bytes. |
| `isMediaPlan(x)` | A `MediaPlan`, see [Media plan](#media-plan). |
| `isPayload(type, x)` | Shape of a parsed payload for a reserved `type`. False for unknown types. |
| `isReserved(type)` | True for `signal.`, `network.` and `handshake.` types. |

`read` parses the payload of reserved types only, so `message.payload` is the parsed object for those and bytes for app types.

Relaying a parsed message with `toBinary(true)` is safe: `Message` encodes an object payload as JSON.

## Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `SERVER` | `"server"` | `receiver` for the signalling server |
| `BROADCAST` | `"*"` | `receiver` for every peer in the network |
| `DEFAULT_TTL` | `16` | relays a new message may take |
| `MAX_TTL` | `255` | largest valid `ttl` |
| `MAX_MESSAGE_BYTES` | `262144` | default `read` limit (256 KiB) |
| `MAX_ID_LENGTH` | `64` | longest `id`, `type`, `sender`, `receiver`, `network` or hop |
| `MAX_HOPS` | `256` | most `hops` entries |
| `MAX_PROFILE_BYTES` | `1024` | largest serialized profile |
| `MAX_TOPOLOGY_BYTES` | `1024` | largest serialized topology config |
| `MAX_MEDIA_ENTRIES` | `16` | most channels, and most streams, in a media plan |
| `RESERVED_CHANNEL_PREFIX` | `"_"` | channel labels starting with it are internal |

## Types

```ts
type PeerId = string;

type Meta<Type extends string = string> = {
    id: string;
    type: Type;
    sender: PeerId;
    receiver: PeerId;   // peer id | SERVER | BROADCAST
    network?: string;
    timestamp: number;
    ttl: number;        // relays left, 0..255
    hops: PeerId[];     // every node that handled it, sender first
};

type NetworkInfo = {
    id: string;
    name: string;
    host: PeerId;
    topology: string | TopologyConfig;
    private: boolean;
    size: number;
    meta?: Record<string, unknown>;
    media?: MediaPlan;
};

type TopologyConfig = { name: string } & Record<string, unknown>; // e.g. { name: "multicast", fanout: 5 }, at most 1 KB as JSON

type Profile = Record<string, unknown>;   // e.g. { name }, at most 1 KB as JSON

type MediaPlan = {
    channels?: Record<string, ChannelInit>;              // data channels, by label
    streams?: Record<string, { kind: "audio" | "video" }>; // media streams, by name
};

type ChannelInit = { ordered?: boolean; maxRetransmits?: number; maxPacketLifeTime?: number; protocol?: string };
```

## Media plan

What every link in a network carries besides its system channel. The host sets it on `signal.register` / `signal.update` and announces changes with `network.media`. `isMediaPlan` enforces:

- at most 16 channels and 16 streams
- labels and names are 1–64 characters
- channel labels don't start with `_` (reserved, e.g. `_system`)
- `ChannelInit` has no `negotiated` or `id` (the peers assign those), and not both `maxRetransmits` and `maxPacketLifeTime`
- counts are non-negative integers, `ordered` is a boolean
- a stream's `kind` is `"audio"` or `"video"`

`PayloadOf<T>` maps a reserved type to its payload (`unknown` for app types). `SignalType`, `NetworkType` and `HandshakeType` are string enums of the wire values below.

# Protocol

| Type | Direction | Payload |
| --- | --- | --- |
| `signal.register` | client → server | `{ name, topology, private?, password?, meta?, media? }`, `topology` is a name or a `TopologyConfig`, stored and returned as-is in `NetworkInfo` |
| `signal.update` | client → server | `{ network, name?, private?, password?, meta?, media? }` |
| `signal.unregister` | client → server | `{ network }` |
| `signal.list` | client → server | `{}` |
| `signal.join` | client → server | `{ network, password?, profile? }` |
| `signal.leave` | client → server | `{ network }` |
| `signal.welcome` | server → client | `{ id }` |
| `signal.registered` | server → client | `{ network: NetworkInfo }` |
| `signal.updated` | server → client | `{ network: NetworkInfo }` |
| `signal.networks` | server → client | `{ networks: NetworkInfo[] }` |
| `signal.host` | server → client | `{ network: NetworkInfo }`, you are now host |
| `signal.unreachable` | server → client | `{ receiver, ref }`, `ref` is the undeliverable message's id |
| `signal.error` | server → client | `{ code, message, ref? }` |
| `network.join` | peer ↔ peer | `{ password?, profile? }`, the server forwards it to the entry peer with `sender` = newcomer |
| `network.welcome` | peer ↔ peer | `{ network: NetworkInfo, members: PeerId[], connect: PeerId[], profiles? }` |
| `network.reject` | peer ↔ peer | `{ reason }` |
| `network.members` | peer ↔ peer | `{ members: PeerId[], host?, profiles? }`, `profiles` maps member id → `Profile` |
| `network.leave` | peer ↔ peer | `{ peer }` |
| `network.profile` | member → host | `{ profile }`, the sender changed its own profile |
| `network.media` | host → peers | `{ media: MediaPlan }`, the plan changed mid-session |
| `network.relay` | member → host | `{ message }`, base64 bytes of a signalling message from a member without a socket, for the host to send through its own |
| `handshake.offer` | peer ↔ peer | `{ description: { type, sdp? }, streams? }`, `streams` maps transceiver `mid` → stream name |
| `handshake.answer` | peer ↔ peer | `{ description: { type, sdp? } }` |
| `handshake.candidate` | peer ↔ peer | `{ candidate: { candidate?, sdpMid?, sdpMLineIndex?, usernameFragment? } }` |

Peer ↔ peer messages travel over any link: the signalling socket while there is no data channel yet, peer data channels after.

# Relay rules

`relay(meta, me)`, in order:

1. `me` is already in `hops` → `drop` (loop).
2. Push `me` onto `hops`.
3. `receiver === me` → `deliver`.
4. Spend one `ttl`.
5. `receiver === BROADCAST` → `both` while `ttl > 0`, else `deliver`.
6. Otherwise → `forward` while `ttl > 0`, else `drop`.

`ttl` never goes below 0. Since `ttl` is at most 255 and every node adds one hop, `hops` never exceeds `MAX_HOPS`.

# Lifecycle

```
peer                         server                       entry peer
 │ ── connect socket ───────▶ │                              │
 │ ◀── signal.welcome {id} ── │                              │
 │ ── signal.list ──────────▶ │                              │
 │ ◀── signal.networks ────── │                              │
 │ ── signal.join ──────────▶ │ ── network.join ───────────▶ │
 │ ◀────────────── network.welcome / network.reject ──────── │
 │ ◀──────── handshake.offer / answer / candidate ─────────▶ │  (per peer in `connect`)
 │ ══════════════════ data channel open ═══════════════════ │
 │ ◀──────────────────── network.members ─────────────────── │
 │ ── signal.leave ─────────▶ │ ── network.leave ──────────▶ │
```

The host creates a network with `signal.register` and gets `signal.registered`. When a host leaves, the server sends `signal.host` to the peer that takes over. A message the server can't deliver comes back as `signal.unreachable`.

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related

- [@papit/meta-json](https://github.com/onkelhoy/papit/tree/main/packages/network/meta-json)
  The binary container `Message` extends.
- [@papit/webrtc](https://github.com/onkelhoy/papit/tree/main/packages/network/webrtc)
  Peer-to-peer networking in the browser.
- [@papit/signal-server](https://github.com/onkelhoy/papit/tree/main/packages/network/signal-server)
  The signalling server.
