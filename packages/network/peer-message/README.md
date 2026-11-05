# @papit/peer-message

Shared message format, signalling protocol and network registry for @papit/webrtc and @papit/signal-server, built on @papit/meta-json. Reach for it to create, validate and relay peer messages, or to keep networks and their anchors for a rendezvous of your own, in node or the browser.

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

A rendezvous of your own, with the same bookkeeping as the signal server:

```js
import { Registry } from "@papit/peer-message";

const registry = new Registry({ hash: sha256 });
for (const { to, message } of registry.register(peer, { name: "lobby", topology: "mesh" })) deliver(to, message);
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

## Registry

```ts
class Registry {
    constructor(options?: RegistryOptions);
    networks: Map<string, RegisteredNetwork>;
    info(network): NetworkInfo;          // as clients see it: no hashes, size = members
    list(): NetworkInfo[];               // public networks
    register(from, payload): Reply[];
    update(from, payload, ref): Reply[];   // anchors only
    unregister(from, payload, ref): Reply[]; // anchors only
    join(from, payload, ref): Reply[];
    anchor(from, payload, ref): Reply[];
    unanchor(from, payload): Reply[];
    leave(from, network): Reply[];
    drop(from): Reply[];                 // a socket closed: it leaves every network
}
type Reply = { to: PeerId; message: Message };
```

Pure bookkeeping of networks and their **anchors** (the peers keeping a connection to the registry, in join order). It does no I/O: every method returns the messages to deliver, so the signal server, a test or a peer acting as rendezvous can share it. Each method is O(members) of the network it touches.

| Option | Default | Description |
| --- | --- | --- |
| `hash(secret)` | identity | Hashes passwords before they're stored. Pass a real hash when networks have passwords. |
| `pickEntry(network, members, newcomer)` | the first anchor | Who gets a newcomer's `network.join`. |
| `reachable(peer)` | always true | False for a peer that can't be sent to; the joiner gets `signal.unreachable`. |
| `id()` | random uuid | Ids for new networks. |

- **Key hash.** The creator sends `keyHash` (SHA-256 of the network key) on register. The registry never sees the key. A `signal.join` with a `merge` whose `keyHash` matches heals a split and skips the password. A `signal.anchor` with the wrong `keyHash` is `forbidden`.
- **Anchors.** `register` makes the sender the first anchor. `anchor` adds one until `anchors` (the target) is met, or re-creates a network the registry forgot. An existing network answers `existed: true` with its first other anchor as `entry`. Every change goes to all anchors as `signal.anchors`. A network goes when its last anchor does.

## Guards

For untrusted input. None of them throw.

| Function | Purpose |
| --- | --- |
| `read(bytes, maxBytes = MAX_MESSAGE_BYTES)` | Decode and validate a `Uint8Array`, `ArrayBuffer` or other view. Returns a `Message`, or `null` when the input is too big, can't be decoded, has a bad meta, or is a reserved type with a bad payload. |
| `isMeta(x)` | Shape and limits of a `Meta`, including `hint` and `via`. |
| `isProfile(x)` | A JSON object of at most `MAX_PROFILE_BYTES` UTF-8 bytes. |
| `isTopology(x)` | A topology name of 1..`MAX_ID_LENGTH` characters, or a `TopologyConfig` with such a `name` of at most `MAX_TOPOLOGY_BYTES` UTF-8 bytes. |
| `isMediaPlan(x)` | A `MediaPlan`, see [Media plan](#media-plan). |
| `isPayload(type, x)` | Shape of a parsed payload for a reserved `type`. A `topology.*` payload is only size-checked. False for unknown types. |
| `isReserved(type)` | True for `signal.`, `network.`, `handshake.` and `topology.` types. |
| `isKeyReceiver(id)` | `KEY_PREFIX` + a hex hash, at most `MAX_ID_LENGTH` characters. |

`read` parses the payload of reserved types only, so `message.payload` is the parsed object for those and bytes for app types.

Relaying a parsed message with `toBinary(true)` is safe: `Message` encodes an object payload as JSON.

## Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `SERVER` | `"server"` | `receiver` for the signalling server |
| `BROADCAST` | `"*"` | `receiver` for every peer in the network |
| `KEY_PREFIX` | `"@"` | `receiver` prefix for a key receiver: `"@"` + hex hash, routed by the topology |
| `DEFAULT_TTL` | `16` | relays a new message may take |
| `MAX_TTL` | `255` | largest valid `ttl` |
| `MAX_MESSAGE_BYTES` | `262144` | default `read` limit (256 KiB) |
| `MAX_ID_LENGTH` | `64` | longest `id`, `type`, `sender`, `receiver`, `network`, `hint` or hop |
| `MAX_HOPS` | `256` | most `hops` entries |
| `MAX_VIA` | `8` | most `via` waypoints |
| `MAX_PROFILE_BYTES` | `1024` | largest serialized profile |
| `MAX_TOPOLOGY_BYTES` | `1024` | largest serialized topology config |
| `MAX_TOPOLOGY_PAYLOAD_BYTES` | `16384` | largest serialized `topology.*` payload |
| `MAX_MEDIA_ENTRIES` | `16` | most channels, and most streams, in a media plan |
| `RESERVED_PREFIXES` | `signal.`, `network.`, `handshake.`, `topology.` | types owned by the protocol |
| `TOPOLOGY_PREFIX` | `"topology."` | type prefix of topology messages |
| `RESERVED_CHANNEL_PREFIX` | `"_"` | channel labels starting with it are internal |

## Types

```ts
type PeerId = string;

type Meta<Type extends string = string> = {
    id: string;
    type: Type;
    sender: PeerId;
    receiver: PeerId;   // peer id | SERVER | BROADCAST | KEY_PREFIX + hash
    network?: string;
    timestamp: number;
    ttl: number;        // relays left, 0..255
    hops: PeerId[];     // every node that handled it, sender first
    hint?: string;      // per-hop routing hint a topology sets and reads
    via?: PeerId[];     // waypoints: via[0] first, which removes itself and passes it on
};

type NetworkInfo = {
    id: string;
    name: string;
    topology: string | TopologyConfig;
    private: boolean;
    size: number;
    anchors?: number;   // how many peers keep a socket to the registry
    beacon?: number;    // ms between anchor beacons, 0 = off
    entries?: PeerId[]; // peers a joiner may enter through (invites)
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

`PayloadOf<T>` maps a reserved type to its payload (`unknown` for app types). `SignalType`, `NetworkType` and `HandshakeType` are string enums of the wire values below.

## Media plan

What every link in a network carries besides its system channel. An anchor sets it on `signal.register` / `signal.update`, and members get changes through `network.adopt`. `isMediaPlan` enforces:

- at most 16 channels and 16 streams
- labels and names are 1–64 characters
- channel labels don't start with `_` (reserved, e.g. `_system`)
- `ChannelInit` has no `negotiated` or `id` (the peers assign those), and not both `maxRetransmits` and `maxPacketLifeTime`
- counts are non-negative integers, `ordered` is a boolean
- a stream's `kind` is `"audio"` or `"video"`

# Protocol

| Type | Direction | Payload |
| --- | --- | --- |
| `signal.register` | client → server | `{ name, topology, private?, password?, meta?, media?, anchors?, keyHash? }`. The sender becomes the first anchor. |
| `signal.update` | anchor → server | `{ network, name?, private?, password?, meta?, media? }`, `password: ""` opens the network |
| `signal.unregister` | anchor → server | `{ network }` |
| `signal.list` | client → server | `{}` |
| `signal.join` | client → server | `{ network, password?, profile?, merge? }`, `merge: { network, topology, keyHash? }` makes it a merge of the sender's network |
| `signal.leave` | client → server | `{ network }` |
| `signal.anchor` | client → server | `{ network: NetworkInfo, keyHash, peer }`: become an anchor, or re-create a network the registry forgot. `peer` is the sender's peer id when it isn't its socket id |
| `signal.unanchor` | anchor → server | `{ network }` |
| `signal.drain` | client → server | `{ draining }`, sent before closing a socket on purpose. While `draining` the server stops forwarding to it |
| `signal.welcome` | server → client | `{ id }` |
| `signal.registered` | server → client | `{ network: NetworkInfo }` |
| `signal.updated` | server → client | `{ network: NetworkInfo }` |
| `signal.networks` | server → client | `{ networks: NetworkInfo[] }` |
| `signal.anchored` | server → client | `{ network, ok, existed, entry? }`. With `existed` and `entry`, the caller merges through `entry` |
| `signal.anchors` | server → anchors | `{ network, anchors: PeerId[], target }`, on every change of the anchor set |
| `signal.drained` | server → client | `{}`, nothing more is on its way to this socket |
| `signal.unreachable` | server → client | `{ receiver, ref }`, `ref` is the undeliverable message's id |
| `signal.error` | server → client | `{ code, message, ref? }` |
| `network.join` | peer → entry | `{ password?, profile?, merge? }`, the server forwards it with `sender` = newcomer, without the password it already checked |
| `network.admit` | entry → peer | `{ network: NetworkInfo, key, merge }`, the join was admitted. `key` is the network key |
| `network.reject` | entry → peer | `{ reason }` |
| `network.adopt` | broadcast | `{ network: NetworkInfo, key }`, after a merge or an update: take this identity or info |
| `network.leave` | peer ↔ peer | `{ peer }` |
| `network.prune` | peer ↔ peer | `{}`, "I no longer want this link". It closes once neither side wants it |
| `network.anchor` | anchor → peer | `{}`, become an anchor too |
| `network.beacon` | broadcast | `{ anchors }`, the first anchor's heartbeat, for split detection |
| `network.ping` / `network.pong` | link | `{ n }`, round-trip time |
| `network.media` | peer ↔ peer | `{ media: MediaPlan }` |
| `network.room` | peer ↔ peer | `{ room, message }`, base64 bytes of a message of a network carried over this one, for the receiver's `room` |
| `topology.*` | peer ↔ peer | any JSON up to `MAX_TOPOLOGY_PAYLOAD_BYTES`. The topology that sent it validates it |
| `handshake.offer` | peer ↔ peer | `{ description: { type, sdp? }, streams?, session? }`, `streams` maps transceiver `mid` → stream name, `session` names the sender's connection |
| `handshake.answer` | peer ↔ peer | `{ description: { type, sdp? }, session? }` |
| `handshake.candidate` | peer ↔ peer | `{ candidate: { candidate?, sdpMid?, sdpMLineIndex?, usernameFragment? } }` |

Peer ↔ peer messages travel over any link: the signalling socket while there is no data channel yet, peer data channels after.

Removed with the old engine: `network.welcome`, `members`, `profile`, `relay`, `merge`, `merge-accept`, `merge-list`, `merge-view`, `suspect`, `probe`, `alive`, `beat`, `signal.merge`, `signal.host` and `NetworkInfo.host`. Merges go through `signal.join` with `merge`, and nobody is host: any anchor may update or merge.

# Relay rules

`relay(meta, me)`, in order:

1. `me` is already in `hops` → `drop` (loop).
2. Push `me` onto `hops`.
3. `receiver === me` → `deliver`.
4. Spend one `ttl`.
5. `receiver === BROADCAST` → `both` while `ttl > 0`, else `deliver`.
6. Otherwise → `forward` while `ttl > 0`, else `drop`.

`ttl` never goes below 0. Since `ttl` is at most 255 and every node adds one hop, `hops` never exceeds `MAX_HOPS`. Where a message goes next (`via`, key receivers, `hint`) is up to the node's topology, not `relay`.

# Lifecycle

```
peer                         server                       entry peer
 │ ── connect socket ───────▶ │                              │
 │ ◀── signal.welcome {id} ── │                              │
 │ ── signal.join ──────────▶ │ ── network.join ───────────▶ │  (password checked by the server)
 │ ◀──────────────── network.admit / network.reject ──────── │
 │ ◀──────── handshake.offer / answer / candidate ─────────▶ │
 │ ══════════════════ data channel open ═══════════════════ │
 │ ◀────────────── topology.* (who else to link to) ──────── │
 │ ── close socket (not an anchor) ──▶ │                     │
```

The creator registers with `signal.register` and is the first anchor. Anchors keep their socket, answer `signal.anchors`, and recruit more anchors with `network.anchor` until the target is met. Everyone else drops the socket once joined. A message the server can't deliver comes back as `signal.unreachable`.

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
