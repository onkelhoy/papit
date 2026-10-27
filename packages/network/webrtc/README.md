# @papit/webrtc

Peer-to-peer networking in the browser with a pluggable topology. Reach for it to route messages between peers over WebRTC or any transport, in a mesh, star, chord or your own topology, with plan-driven data channels and media streams.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-network-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/webrtc.svg?logo=npm)](https://www.npmjs.com/package/@papit/webrtc)

---

# Installation

```bash
npm install @papit/webrtc
```

It needs a running [`@papit/signal-server`](https://github.com/onkelhoy/papit/tree/main/packages/network/signal-server) to find peers. After that, messages travel peer to peer over WebRTC data channels. The messages are [`@papit/peer-message`](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message) messages.

# Usage

Host a network:

```js
import { Client } from "@papit/webrtc";

const client = new Client({ url: "ws://localhost:3000", topology: "mesh" });
const network = await client.create({ name: "lobby" });

client.addEventListener("message", ({ detail }) => console.log(detail.sender, detail.payload));
```

Join it from another tab or machine:

```js
const client = new Client({ url: "ws://localhost:3000" });
const [lobby] = await client.list();
await client.join(lobby.id);

client.broadcast("chat", { text: "hej" });
client.send(someone, "chat", { text: "just you" });
```

Password, admission and STUN:

```js
const client = new Client({
    url: "wss://signal.example.com",
    rtc: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
    accept: (newcomer, network) => network.size < 8,   // runs on the entry peer
});
await client.create({ name: "private room", private: true, password: "secret" });
```

# API

## Client

```ts
class Client extends EventTarget {
    constructor(options: ClientOptions);
    readonly ready: Promise<PeerId>;
    id: PeerId | null;
    network: NetworkInfo | null;
    readonly members: readonly PeerId[];
    readonly links: readonly PeerId[];
    readonly host: PeerId | null;
    readonly status: "connecting" | "waking" | "connected" | "reconnecting" | "closed";
    readonly profiles: Record<PeerId, Profile>;
    profile(peer?: PeerId): Profile | undefined;
    setProfile(profile: Profile): boolean;
    readonly socket: SocketLink;
    router: Network | null;

    readonly media: Media;

    create(options: { name: string; private?: boolean; password?: string; meta?: object; media?: MediaPlan }): Promise<NetworkInfo>;
    update(options: { name?: string; private?: boolean; password?: string; meta?: object; media?: MediaPlan }): Promise<NetworkInfo>;
    list(): Promise<NetworkInfo[]>;
    join(networkId: string, password?: string): Promise<NetworkInfo>;
    send(receiver: PeerId, type: string, payload?: unknown): boolean;
    broadcast(type: string, payload?: unknown): boolean;
    leave(): void;
    close(): void;
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `string \| URL` | - | the signal server |
| `protocols` | `string \| string[]` | - | WebSocket sub-protocols |
| `rtc` | `RTCConfiguration` | - | passed to every `RTCPeerConnection`, e.g. `iceServers` |
| `topology` | `string \| Topology` | `"mesh"` | for networks you `create`. A joined network uses the topology it names; a custom one is used when its `name` matches |
| `keepSocket` | `boolean` | `true` | `false` closes the socket once joined and linked |
| `accept` | `(newcomer, info) => boolean` | accept all | runs on the entry peer; `false` sends `network.reject` |
| `timeout` | `number` | `15000` | ms before `create`, `list` and `join` reject |
| `connectTimeout` | `number` | none | ms without a server connection before giving up for good; `ready` rejects and `status` becomes `closed` |
| `wake` | `boolean` | `true` | while not connected, `GET <http url>/health` every 4 s so a sleeping host boots (`ws:` → `http:`, `wss:` → `https:`); errors are ignored |
| `profile` | `Profile` | `{}` | what you say about yourself, e.g. `{ name }`, at most 1 KB as JSON |

| Method | Purpose |
| --- | --- |
| `create` | Registers a network, optionally with a [media plan](#media). You become its host. Resolves on `signal.registered`. |
| `update` | Host only. Sends `signal.update`. A new `media` plan is also sent to every member as `network.media` and applied to every link. |
| `list` | Public networks on the server. |
| `join` | Resolves on `network.welcome`. Rejects on `signal.error`, `network.reject`, `signal.unreachable` for this request, or a timeout. |
| `send` / `broadcast` | App messages. A reserved type (`signal.*`, `network.*`, `handshake.*`) emits `error` instead and returns false. |
| `setProfile` | Changes your profile. In a network it goes to the host as `network.profile`, and the host shares it in `network.members`. False, plus an `error`, for anything but a JSON object of up to 1 KB. |
| `profile` / `profiles` | One member's profile (yours without an id), or all known profiles by id. Profiles of members who left are dropped. |
| `leave` | Sends `signal.leave`, broadcasts `network.leave`, closes every peer link. |
| `close` | `leave`, then closes the socket and rejects pending requests. |

| Event | Detail |
| --- | --- |
| `message` | `{ type, sender, payload, meta }`, with `payload` parsed from JSON |
| `peer` / `peer-left` | `PeerId`, a direct link opened / closed |
| `members` | `{ members, profiles }`: sorted ids, you included, and the profiles by id |
| `status` | the new `status` |
| `host` | `PeerId` |
| `unreachable` | `{ receiver, ref }`, `ref` is the message id |
| `drop` | `Message`, dropped by relay rules or a topology filter |
| `error` / `debug` | `{ type, message, payload }` |

## Network

The transport-agnostic router under `Client`. Use it on its own with your own links, e.g. `MemoryLink` in tests.

```ts
class Network extends EventTarget {
    constructor(options: { me: PeerId; info?: NetworkInfo; topology?: Topology | string });
    readonly me: PeerId;
    info?: NetworkInfo;
    topology: Topology;
    readonly view: View;
    addLink(link: Link): void;
    removeLink(id: PeerId): void;
    setMembers(members: Iterable<PeerId>, host?: PeerId): void;
    desired(): PeerId[];
    send(message: Message, options?: { preferServer?: boolean }): boolean;
    close(): void;
}
```

| Method | Purpose |
| --- | --- |
| `addLink` | Attaches a link. One with id `SERVER` becomes the server link. Replaces and closes an existing link with the same id. |
| `removeLink` | Detaches the link, removes its listeners and closes it. A link that closes itself is removed the same way. |
| `setMembers` | Replaces the member list (`me` is always kept) and optionally the host. |
| `desired` | Members the topology wants `me` linked to that aren't linked yet. |
| `send` | Fills in an empty `sender` with `me` and a missing `network` with `info.id`, then routes (see [Routing](#routing)). |
| `close` | Closes and removes every link and forgets the members. |

Events: `message`, `drop` and `unreachable` (detail `Message`), `link` / `unlink` (detail `PeerId`), `error`, `debug`.

## Links

```ts
interface Link extends EventTarget {
    readonly id: PeerId;   // the remote node, SERVER for the signalling socket
    readonly open: boolean;
    send(bytes: Uint8Array): boolean;
    close(): void;
}
```

Every link fires `open`, `close` and `message` (`CustomEvent<Uint8Array>`). Any transport with this shape can carry a network.

| Class | What it is |
| --- | --- |
| `SocketLink(url, { protocols?, attempts?, timeout? })` | WebSocket to the signal server. It keeps connecting and reconnecting with a backoff of 0.7 s, 1.4 s, … capped at 5 s, with no limit unless `attempts` or `timeout` (ms without a connection) is set; running out emits `error` with type `limit`. It queues sends in order meanwhile and fires `welcome` (detail: id) on every welcome. `close` fires only once it gives up or `close()` is called. |
| `PeerLink(me, id, network, { rtc?, timeout? })` | One `RTCPeerConnection` with the negotiated system channel (`SYSTEM_CHANNEL` = `"_system"`, id 0) that carries every system message and `Client.send` / `broadcast`, plus its `Handshake`. `open` while the channel is open. Closes on channel close or connection `failed` / `closed`. |
| `MemoryLink.pair(aId, bId)` | Both ends of an in-memory link. The first end belongs to `aId`, so its `id` is `bId`. Async (one microtask per message), in order, and copies the bytes. Closing one end closes both. |

`Handshake` negotiates a `PeerLink` for its whole life using perfect negotiation: on glare the lower id is polite and rolls back. `start()` resolves once, when the system channel opens, and fails after `HANDSHAKE_TIMEOUT` (15 s). After that the handshake keeps renegotiating on `negotiationneeded` (new channels, stream slots, direction changes) until the link closes.

## Topology

```ts
type View = { me: PeerId; host: PeerId; members: readonly PeerId[]; links: readonly PeerId[] };

interface Topology {
    readonly name: string;
    neighbors(view: View, id: PeerId): PeerId[];
    route(view: View, meta: Meta): PeerId[];
    filter?(view: View, meta: Meta): RelayAction | undefined;
    media?(view: View, peer: PeerId, plan: MediaPlan): MediaPlan;
}

const topologies: Record<string, Topology>; // { mesh, star, chord }
```

`neighbors` gives the direct links `id` should hold. `route` gives next hops drawn from `view.links` (`[]` means no peer route). `filter` runs on every received message before `relay`: `"drop"` or `"deliver"` replace relay's decision, while `"forward"` and `"both"` still go through relay's loop and `ttl` checks. `media` narrows the plan per direct link, see [Media](#media).

# Media

The network's media plan lives in `NetworkInfo.media` ([shape and rules](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message#media-plan)). The host sets it with `create` / `update`, and everyone works with it through `client.media`.

```js
const client = new Client({ url: "ws://localhost:3000" });
await client.create({
    name: "call",
    media: {
        channels: { chat: { ordered: true }, state: { ordered: false, maxRetransmits: 0 } },
        streams: { camera: { kind: "video" }, mic: { kind: "audio" }, screen: { kind: "video" } },
    },
});

const camera = await client.media.start("camera");               // getUserMedia({ video: true })
await client.media.start("screen");                              // getDisplayMedia, because of the name
await client.media.start("mic", { audio: { echoCancellation: true } });

client.media.addEventListener("stream", ({ detail }) => show(detail.peer, detail.name, detail.stream));
client.media.addEventListener("stream-ended", ({ detail }) => hide(detail.peer, detail.name));

const state = client.media.channel("state");
state.addEventListener("message", ({ detail }) => apply(detail.peer, detail.data));
state.broadcast(JSON.stringify({ x: 1 }));
```

## Lazy slots

Each `PeerLink` gets the plan before its first offer, so the first negotiation already carries it:

- **Channels:** one negotiated data channel per plan channel, in sorted label order, with ids 1, 2, … (0 is `_system`).
- **Streams:** an empty transceiver per stream, in sorted name order. Nothing is captured and nothing is sent, so there's no permission prompt until `start()`.
- **Owner:** the lower id of a link creates its transceivers. Every offer carries `streams`, a map from transceiver `mid` to stream name, and the other side adopts the transceivers by `mid`. This mapping holds up against glare and against slots added mid-session; mapping by order doesn't.

`start(name)` puts the capture's track into that stream's slot on every link with `replaceTrack` and sets the slot to `sendrecv`. `stop(name)` sets the slot back to `recvonly`, removes the track and stops it. Direction changes renegotiate through the handshake. A remote stream appears as `stream` when its track unmutes, and goes away as `stream-ended` when it mutes or the link closes.

## Media API

```ts
class Media extends EventTarget {
    readonly plan: MediaPlan;
    start(name: string, source?: MediaStream | (MediaStreamConstraints & { display?: boolean })): Promise<MediaStream>;
    stop(name: string): void;
    streams(peer?: PeerId): Map<string, MediaStream>;   // remote streams from peer, or your captures
    channel(label: string): Channel;
    close(): void;
}

class Channel extends EventTarget {
    readonly label: string;
    readonly peers: PeerId[];                           // peers with this channel open
    send(peer: PeerId, data: string | Blob | ArrayBuffer | ArrayBufferView): boolean;
    broadcast(data): number;                            // how many peers it went to
}
```

`start` without a source asks for the plan's kind with `getUserMedia`. It uses `getDisplayMedia` instead when `display: true` is given or the stream is named `screen`. When the user ends a screen share from the browser, the capture stops by itself.

| Event | Detail |
| --- | --- |
| `stream` / `stream-ended` | `{ peer, name, stream }` / `{ peer, name }`, remote |
| `capture` / `capture-ended` | `{ name, stream }` / `{ name }`, local |
| `channel-open` / `channel-close` | `{ peer, label }` |
| `message` (on a `Channel`) | `{ peer, data }`, raw: no peer-message framing |

Channels are direct only. A `Channel` reaches the peers you have a link to, and nothing is relayed. Messages that arrive before `channel(label)` was first called are dropped. Labels starting with `_` are reserved: they're rejected in a plan, and `channel("_system")` throws.

## Per-link narrowing

A topology can narrow what goes over one link:

```js
const stage = {
    ...topologies.star,
    name: "stage",
    media: (view, peer, plan) => view.me === view.host ? plan : { ...plan, streams: {} }, // only the hub sends
};
```

Only `streams` are narrowed. Channels always follow the full plan, because both ends have to agree on the channel ids. A stream left out for a link isn't sent on it: its slot stays `recvonly`, or ends up inactive if both sides leave it out.

## Mid-session changes

`client.update({ media })` stores the new plan on the server and sends `network.media` to every member. Only `network.media` from the current host is accepted. Each peer applies it to its existing links:

- New channels open on the lowest free ids.
- Removed channels close.
- New streams get slots (the owner adds them and renegotiates).
- Removed streams go inactive, and their local captures stop.

# Topologies

| Topology | Links per node | `route` | Broadcast |
| --- | --- | --- | --- |
| `mesh` | every other member | the receiver if linked | every link not in `hops` |
| `star` | hub (`host`): everyone. Leaf: the hub | leaf: the hub. Hub: the receiver if linked | leaf: the hub. Hub: every link not in `hops` |
| `chord` | predecessor, successor, and `successor(hash + 2^i)` for i = 0..31 | the receiver if linked, else the closest preceding link on the ring, else the successor | every link not in `hops` |

Chord hashes ids with FNV-1a onto a 2^32 ring (`fnv1a` is exported), so lookups take O(log n) hops.

A custom topology, here a mesh that drops `"spam"`. Every peer has to use it, so pass it to each `Client` with the same `name`:

```js
import { Client, topologies } from "@papit/webrtc";

const quiet = { ...topologies.mesh, name: "quiet", filter: (view, meta) => meta.type === "spam" ? "drop" : undefined };
const client = new Client({ url: "ws://localhost:3000", topology: quiet });
```

# Routing

Outgoing, in order:

1. A direct link to the receiver (`SERVER` uses the server link).
2. With `preferServer` (handshakes and welcomes): the server link.
3. `topology.route`.
4. The server link, for this node's own unicast messages only. The server doesn't relay broadcasts or other senders' messages.
5. `unreachable`.

A broadcast goes to the `route` result and is marked seen.

Incoming bytes go through peer-message's `read` (malformed → `error`). A broadcast already seen is dropped quietly. Then come `topology.filter` and `relay(meta, me)`: `deliver` / `both` emit `message`, `forward` / `both` re-route without re-stamping, and `drop` emits `drop`.

# Protocol

The message types and payloads are listed in [peer-message's protocol table](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message#protocol). On top of them, webrtc runs these flows:

| Flow | What happens |
| --- | --- |
| join | The server forwards `network.join` to the entry peer (the host by default). The entry checks `accept`, adds the newcomer and sends `network.welcome { network, members, connect }` via the server, where `connect = topology.neighbors(view, newcomer)`. It then sends `network.members { members, host }` to the existing members. The entry reconciles, and so does the newcomer for everyone in `connect`, with the initiator rule below. |
| reconcile | On `network.members`, a lost link or `network.leave`, each peer opens links for `desired()`. Exactly one side of a pair initiates: the lower id, unless the other side's `neighbors` don't include us (chord fingers are one-way). Peers with a pending handshake are skipped. One initiator matters, because rolling back a first offer discards its data channels. |
| media | `network.media { media }` from the host replaces the plan on every peer, which applies it to its links (see [Mid-session changes](#mid-session-changes)). |
| host change | When the host leaves, the server sends `signal.host` to the next host. It sends `network.members { members, host: me }` to every member, through the server if it has no route yet, and reconciles. A host also sends the members to every peer whose link opens. |
| leave | `signal.leave` to the server and `network.leave { peer }` broadcast. Peers drop the member and its profile, then reconcile. |
| profiles | The newcomer's `profile` travels in `signal.join` and the forwarded `network.join`. The host keeps every profile and sends them as `profiles` in `network.welcome` and `network.members`. A member that changes its profile sends `network.profile` to the host, which only accepts it about the sender itself, then sends the members again. A new host already has the profiles from the last `network.members`. |

Only the current host, or a sender naming itself as host, can change the member list.

# Lifecycle

```
connect ──▶ signal.welcome {id} ──▶ create ──▶ signal.registered (host)
                                 └─▶ join ──▶ network.welcome {members, connect}
                                                  │
              handshake.offer / answer / candidate (via the server)
                                                  │
                         data channel open ──▶ peer, network.members, reconcile
                                                  │
                          leave: signal.leave + network.leave ──▶ close
```

If the socket drops, it reconnects with backoff and resends whatever was queued. The server hands out a new id on every reconnect, so after one the server fallback is gone (an `error` with type `reconnect` says so) until you leave and join again. Peer links keep working.

# Status and cold starts

`client.status` follows the signalling socket:

| Status | When |
| --- | --- |
| `connecting` | the first connection attempt is running |
| `waking` | the first connection has been failing for more than 3 s (`WAKING_AFTER`), e.g. a free host is booting |
| `connected` | the server welcomed us |
| `reconnecting` | a connection dropped, and it's retrying |
| `closed` | `close()`, `connectTimeout`, or `keepSocket: false` dropped the socket |

While not connected, `wake` pings `/health` so a sleeping host such as Render's free tier starts booting. See [Deploy on Render](https://github.com/onkelhoy/papit/tree/main/packages/network/signal-server#deploy-on-render). `ready` rejects only on `connectTimeout` or `close()`.

# Live testing with the demo

`views/demo` is a plain-DOM showcase of everything above.

```bash
# terminal 1, from the repo root or any package
npx papit-signal-server --port 3000

# terminal 2, in packages/network/webrtc
npm start
```

Start the signal server first. `npm start` also tries port 3000 and moves on to the next free one. Then open `/views/demo/` on the port it prints, in two or more tabs or browsers.

- **Connection:** the server URL (`wss://<app>.onrender.com` for a deployed one), your display name (your profile), and the STUN toggle, which is on by default and needed across networks. A live badge shows *connecting*, *waking up server…*, *connected* or *reconnecting*.
- **Create:** the name, password, private flag and topology, plus a media plan editor.
  - Channel rows have a label, ordered, and reliable, `maxRetransmits` or `maxPacketLifeTime`. The `_` rule is checked as you type.
  - Stream rows have a name, a kind, and *screen*, which captures with `getDisplayMedia`.
  - Presets: *Chat*, *Video call*, *Game* and *Screen share*.
- **Join:** public networks with topology, size, a lock and a media summary. Join with a password, or paste the id of a private network.
- **In a network:**
  - members by name, with *you*, *host* and direct-link badges, and a rename box
  - a tab per channel (`_system` messages first) with its own log and a send box, to everyone or one member by name
  - start/stop per stream, and a video grid labelled "<name> · <stream>"
  - for the host only, **Edit media plan**, which updates everyone
  - **Leave**
- **Event log**, with a *debug* toggle for handshake and ICE detail.

The URL, name, topology and last plan are remembered in `localStorage`. The demo records which streams are screen captures, and whether the network has a password, in the network's `meta` (`screens`, `locked`), because `NetworkInfo` has no fields for them.

# Known limits

- Media and plan channels are direct only, never relayed. In a star, leaves see only the hub's streams. In a chord, you see only your fingers.
- A link created while a `network.media` update is still in flight can end up with different channel ids on its two ends. Leave and rejoin to fix it.
- Remote streams are detected by track mute and unmute, so browsers that fire these late show streams late.
- No link pruning: links the topology no longer wants stay open until they close.
- `keepSocket: false` loses the server fallback, so new peers can't be handshaked with or admitted through you.
- `status` and `wake` only cover the signalling socket. Peer links come and go on their own (`peer`, `peer-left`).
- Profiles are kept by the host and trusted as sent.
- A socket reconnect gets a new id from the server (see [Lifecycle](#lifecycle)).
- Peers trust each other: any member can send any app message, and the host controls the member list.

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

- [@papit/peer-message](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message)
  The message format, relay rules and protocol.
- [@papit/signal-server](https://github.com/onkelhoy/papit/tree/main/packages/network/signal-server)
  The signalling server.
