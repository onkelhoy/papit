# @papit/webrtc

Peer-to-peer networking in the browser with a pluggable, self-managing topology. Reach for it to route messages between peers over WebRTC or any transport, in a mesh, star, chord, ring, multicast tree or your own topology, with merging, split healing, data channels and media streams.

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

A [`@papit/signal-server`](https://github.com/onkelhoy/papit/tree/main/packages/network/signal-server) finds networks and carries first contact. After that, messages ([`@papit/peer-message`](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message)) travel peer to peer over WebRTC data channels, and most peers close their socket.

# Usage

Create a network:

```js
import { Client } from "@papit/webrtc";

const client = new Client({ url: "ws://localhost:3000" });
const network = await client.create({ name: "lobby", topology: "mesh" });

network.on("message", ({ detail }) => console.log(detail.meta.sender, detail.parse()));
console.log(network.info.id); // share this
```

Join it from another tab or machine, then talk:

```js
const network = await client.join(networkId);

network.broadcast("chat", { text: "hej" });
network.send(peerId, "chat", { text: "hallå" });
network.leave();
```

A chord ring, with messages addressed to a key instead of a peer:

```js
const dht = await client.create({ name: "dht", topology: { name: "chord", successors: 4 } });

dht.sendKey("room:42", "put", { value: 1 });   // reaches whoever owns hash("room:42")
dht.on("range", ({ detail }) => rebalance(detail.from, detail.to));
```

A password, more anchors and a beacon for split healing:

```js
const network = await client.create({ name: "team", topology: "star", password: "secret", anchors: 3, beacon: 10_000 });
const joined = await client.join(network.info.id, { password: "secret", profile: { name: "Ada" } });
```

# API

## Client

```ts
new Client(options: ClientOptions)
client.create(draft: NetworkDraft, setup?: NetworkSetup): Promise<Network>
client.join(network: string | NetworkInfo, request?: JoinRequest, setup?: NetworkSetup): Promise<Network>
client.close(): void
```

One identity and one signalling socket for any number of networks. The socket opens when a network needs it (create, join, becoming an anchor) and closes `SOCKET_GRACE` (1 s) after none does. The peer id is the first id the server assigned and stays the same across reconnects: every later socket gets a new id from the server and sends `signal.resume` with the welcome token first, so it talks as the peer id again. Against a server without resume it falls back to the new id, and only anchors keep their peer id (through `signal.anchor`).

| Option | Type | Description |
| --- | --- | --- |
| `url` | `string \| URL` | The signal server. |
| `protocols` | `string \| string[]` | WebSocket subprotocols. |
| `rtc` | `RTCConfiguration` | Passed to every `RTCPeerConnection`, e.g. `iceServers`. |
| `handshakeTimeout` | `number` | ms before a handshake fails (15 000). |
| `connectTimeout` | `number` | ms without a server connection before the socket gives up. |

`setup` is per network: `bootstrap` (carry it over something other than the server, see [Carrying a network](#carrying-a-network-over-any-medium)), `accept(peer, profile)` (admission, default everyone), `acceptMerge(info)` (default refuse) and `topology` (a local `Topology` function instead of a registered name).

`client.id`, `client.online`, `client.networks`. Events: `network` (`CustomEvent<Network>`), `error`, `debug`.

### NetworkDraft

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Shown in listings. |
| `topology` | `string \| TopologyConfig` | A registered name, or `{ name, ...options }`. Every peer gets the same config. |
| `password` | `string` | Checked by the registry, or by the entry when the bootstrap doesn't check. |
| `private` | `boolean` | Left out of listings. |
| `meta` | `object` | App data on `NetworkInfo`. |
| `media` | `MediaPlan` | Channels and streams every link carries, see [Media](#media). |
| `anchors` | `number` | How many peers keep a socket to the registry (1). |
| `beacon` | `number` | ms between beacons, 0 = no split healing (10 000). |

## Network

One network on one node. It moves bytes and opens links; the topology decides everything else.

| Member | Description |
| --- | --- |
| `send(peer, type, data)` | An app message to `peer`. Throws a `RangeError` for a reserved type (`network.*`, `topology.*`, …). |
| `broadcast(type, data)` | An app message to everyone. |
| `sendKey(key, type, data)` | To whoever owns `hash(key)`. Needs a topology with `owner`. |
| `invite()` | The `NetworkInfo` plus `entries` a joiner can come in through. |
| `known()` | What this node's topology knows. Never "the network". |
| `update(changes)` | Anchors only: name, `private`, `meta`, `password` (empty opens it), `media`. Every member gets it. |
| `merge(target, password?)` | Anchors only: merge this network into `target`, see [Merge](#merge-and-split-healing). |
| `anchor()` | Become an anchor through the bootstrap. The `Client` does this when asked. |
| `leave()` / `close()` | Graceful (the topology says goodbye) / immediate. Both release every link, timer and listener. |
| `carry(room, peer, bytes)` / `inbox(room, take)` | Carry another network's bytes, for a `Bootstrap` built on this one. |
| `info`, `me`, `ready`, `linked`, `anchored`, `closed` | State. `linked` is the set of open direct links. |
| `topology` | The topology's `api`, e.g. `network.topology.successors` in chord. |
| `media` | The [Media](#media) of this network's links. |

| Event | Detail |
| --- | --- |
| `message` | `Message`: `detail.meta.sender`, `detail.parse()` |
| `link` | `{ peer, open, left }`, where `left` means the peer said goodbye first |
| `merged` | `{ bridge, network }` |
| `update` | `NetworkInfo` after an anchor's `update` |
| `anchored` | `boolean` |
| `anchor-request` | `{ from }`: an anchor asks this node to become one |
| `close`, `error`, `debug` | |
| topology events | `leader` (star, multicast), `range` (chord), or your own through `ctx.emit` |

## Built-in topologies

| Name | Shape | Config | `network.topology` | Events |
| --- | --- | --- | --- | --- |
| `mesh` | Everyone links to everyone. App messages must come straight from their sender. | | | |
| `star` | One hub relays for all. The lowest other member is a standby with links to everyone, so it takes over without new links. | | `hub`, `members` | `leader` `{ hub }` |
| `multicast` | A tree with at most `fanout` children. Links to parent, children and grandparent. Streams flow down. | `fanout` (3, 1–64) | `parent`, `children`, `root` | `leader` `{ root }` |
| `chord` | Chord ring with O(log n) lookups. Broadcast reaches each node once. A linked successor that misses 3 stabilize rounds is dropped, so a closed tab doesn't hold up lookups until its link fails. | `successors` (4, 1–16), `fingers` (32, 0–32), `stabilize` (1000 ms), `fixFingers` (250 ms) | `lookup(key)`, `successorsOf(peer)`, `successors`, `predecessor`, `fingers` | `range` `{ from, to }` |
| `ring` | `chord` with `fingers: 0`. | as chord | as chord | as chord |

All of them merge and have `owner`, so `sendKey` works everywhere. `chordTopology(config, { pickFinger, onStabilized })` takes local hooks. `proximity` is a `pickFinger` that picks the lowest round trip. `chordRing` exports the ring math.

```ts
registerTopology(name: string, factory: TopologyFactory): void   // RangeError for a built-in name
resolveTopology(topology: string | TopologyConfig, onError?): Topology
```

Only the config goes over the wire, never code, so every peer registers the same factory under the same name. An unknown name, or a factory that throws on the config, falls back to `mesh` on every peer alike.

# The engine rules

The contract between the engine and a topology:

1. **The engine reports facts and obeys commands.** Facts: a link opened or closed, a message arrived, a join or merge was admitted. Commands: `connect`, `disconnect`, `send`, `forward`.
2. **Wants, not links.** `connect(p)` means "I want a link to p". After `disconnect(p)` the engine sends `network.prune`, and the link closes once neither side wants it.
3. **One link per pair.** When both sides connect at once, the outbound attempt of the lower id wins.
4. **The engine never retries.** A failed or closed link becomes `link(p, false)`, and the topology decides what to do.
5. **Unicast send order:** waypoints (`via`) first, then a direct link, then the back path (the link the target's last message came in on, under 30 s old), then `route(meta)`, then the entry link while joining, then the bootstrap. If none of these works, the message is dropped. Broadcast uses `route(meta)` only.
6. **Scoped resources.** Every timer, link and listener belongs to one `Network` and goes on `close()`. All time goes through an injectable `Clock`.
7. **No throwing from network callbacks.** Bad input is dropped with a `debug` event. A topology handler that throws is reported as `error` and its message is dropped.

# Writing a topology

A topology is a function of a `TopologyContext` that returns a `TopologyNode`. It runs on every node and manages itself.

| Context | Description |
| --- | --- |
| `me`, `config`, `links` | My id, the shared config, my open links (live). |
| `connect(peer, { via? })` / `disconnect(peer)` / `wants(peer)` | Wants (rule 2). `via` signals through waypoints. |
| `send(peer \| BROADCAST, type, payload, { hint?, via? })` | Sends `topology.<type>`. `hint` is read by the next hop. |
| `forward(peer, meta, options?)` | Passes a received message on, keeping its sender. |
| `rtt(peer)` | Round trip in ms over the direct link. |
| `every(ms, fn)` / `after(ms, fn)` | Timers that stop on close. Each returns a cancel function. |
| `emit(type, detail)`, `random()`, `now()` | An event on the `Network`, seeded random, the clock. |

| Node | Required | Description |
| --- | --- | --- |
| `start(entry)` | yes | `entry` is `null` when I created the network. Resolve once joined. |
| `message(from, type, payload, meta)` | yes | `from` is the original sender. **Validate `payload` here.** |
| `route(meta)` | yes | Next hops from the open links, as `peer` or `[peer, hint]`. |
| `join(peer, profile)` | | On the entry, once the newcomer's link opened. |
| `link(peer, open, left)` | | A link opened or closed. |
| `merge(bridge)` | | Absorb the network behind `bridge`. Leave it out to refuse every merge. |
| `owner(key)` | | Who owns `hash(key)`. This enables `sendKey`. |
| `known()`, `entries()`, `api`, `direct`, `ttl()`, `filter(meta)`, `media(peer, plan)`, `relay(name)`, `leave()`, `close()` | | See `TopologyNode` in `src/types.ts`. |

Rules of thumb:

- **The newcomer initiates.** In `start` or `join`, tell the newcomer whom to connect to; don't connect from the old side. A message from the newcomer to the old side has a route through its entry link. The old side has no route back yet, only the back path.
- **Back paths answer strangers.** A reply to a message that was forwarded to you reaches the sender, even before any topology knows it.
- **Across a bridge, use `via`.** During a merge, `connect(peer, { via: [bridge] })` signals through the bridge (at most `MAX_VIA`, 8, waypoints).
- **`merge` must be idempotent.** Merging with your own network (a false alarm from split detection) must change nothing.
- **`owner` must agree on every node**, or `sendKey` messages bounce.

An example: a bus, a line in join order. The tail takes each newcomer. Every node knows the one before its `prev`, so a gap closes on its own. It has no `merge`, so it refuses merges with `"topology can't merge"`.

```js
import { registerTopology } from "@papit/webrtc";

const bus = (ctx) => {
  let prev = null;
  let next = null;
  let before = null;
  let joined = null;
  const wanted = new Set();
  const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;

  const sync = () => {
    const want = new Set([prev, next].filter(Boolean));
    for (const peer of want) ctx.connect(peer);
    for (const peer of wanted) if (!want.has(peer)) ctx.disconnect(peer);
    wanted.clear();
    for (const peer of want) wanted.add(peer);
  };

  const linked = () => {
    ctx.send(prev, "bus.next", {});
    joined?.();
    joined = null;
  };

  return {
    api: { get prev() { return prev; }, get next() { return next; } },
    start(entry) {
      if (!entry) return;
      return new Promise(resolve => {
        joined = resolve;
        ctx.send(entry, "bus.tail", {});
      });
    },
    message(from, type, payload, meta) {
      if (type === "bus.tail")
      {
        if (next) ctx.forward(next, meta);
        else ctx.send(meta.sender, "bus.prev", { before: prev });
      }
      if (type === "bus.prev" && (payload.before === null || isId(payload.before)))
      {
        if (prev && prev !== from) return;
        const fresh = prev !== from;
        prev = from;
        before = payload.before;
        sync();
        if (fresh && ctx.links.has(prev)) linked();
      }
      if (type === "bus.next")
      {
        next = from;
        sync();
        ctx.send(from, "bus.prev", { before: prev });
      }
      if (type === "bus.before" && from === prev && (payload.before === null || isId(payload.before))) before = payload.before;
    },
    link(peer, open) {
      if (open)
      {
        if (peer === prev) linked();
        return;
      }
      if (peer === next) next = null;
      if (peer === prev)
      {
        // the gap closes from behind: link to the one before, and tell my next about it
        prev = before;
        before = null;
        if (next) ctx.send(next, "bus.before", { before: prev });
      }
      sync();
    },
    route(meta) {
      if (ctx.links.has(meta.receiver)) return [meta.receiver];
      // a missing neighbour sits behind the gap: let the bootstrap reach it
      if (meta.receiver === prev || meta.receiver === next) return [];
      return [prev, next].filter(peer => peer && ctx.links.has(peer) && !meta.hops.includes(peer));
    },
    known() {
      return [prev, next].filter(Boolean);
    },
  };
};

registerTopology("bus", () => bus);
const line = await client.create({ name: "line", topology: "bus" });
```

The `tail` request walks down the line with `forward`, and the tail's answer finds the newcomer on the back path. The newcomer then connects to its `prev`. `sync` keeps the wants equal to `{ prev, next }`, so old links get pruned. The test harness runs this exact code (`tests/core/main.js`).

# Anchors and beacons

An **anchor** is a peer that keeps a socket to the registry, so the network can still be found and joined. The creator is the first one. While a network has fewer than `anchors`, its lowest anchor asks one linked peer at a time to become one (`anchor-request`, which the `Client` answers on its own). Every other peer closes its socket once it has joined. Becoming an anchor later (asked, re-anchoring, or `network.anchor()`) opens a socket again, which resumes the peer id. After a reconnect or a server restart, anchors re-anchor on their own.

The first anchor broadcasts a **beacon** every `beacon` ms. A node that misses three beacons waits a random part of one interval, then re-anchors:

- the registry forgot the network: this part carries it on, with that node as its first anchor
- the network still exists elsewhere: this part [heals](#merge-and-split-healing) into it

A bootstrap without `anchor` (`ParentBootstrap`) has no anchors, so it has no split healing either.

# Merge and split healing

```js
// on b, an anchor of network B
const a = await client.create({ name: "a", topology: "chord" }, { acceptMerge: info => info.name === "b" });
await b.merge(a.info.id, "password-of-a");
```

The engine brings a bridge link into place, checks that both sides run the same topology config, and moves B's members to A's identity (a broadcast `network.adopt`). Then it calls `topology.merge(bridge)` on both ends, and the topology does the rest:

- `mesh` connects everyone across the bridge
- `star` and `multicast` fold under the lower-id leader
- `chord` joins the two rings into one

A merge is refused for a topology mismatch, a topology without `merge`, a wrong password, or an `acceptMerge` that says no (the default).

**Split healing** is a merge into your own network id that proves membership with the key hash, so it skips the password and `acceptMerge`.

# Carrying a network over any medium

webrtc has no notion of rooms. A `Bootstrap` decides how a network is found and first reached, and `ParentBootstrap` carries a network over another one, with no server involved:

```js
import { ParentBootstrap } from "@papit/webrtc";

// in the lobby, create a sub-network carried by it
const room = await client.create({ name: "room", topology: "mesh" }, { bootstrap: new ParentBootstrap(lobby, crypto.randomUUID()) });
lobby.send(friend, "invite", room.invite());

// the friend joins through the invite's entries
const invite = message.parse();
const joined = await client.join(invite, {}, { bootstrap: new ParentBootstrap(lobby, invite.id) });
```

A carried network is private and is joined by invite only. Each entry gets `ENTRY_TIMEOUT` (5 s) before the next one is tried. When the parent closes, the carried network plays on over its own links and only stops taking newcomers: the bootstrap dispatches `detached`, and `carry(parent)` hands it a new parent (`carried`). `carried` (getter) says whether one carries it now.

To carry a network over something else (a BroadcastChannel, a game server, your own rendezvous), implement `Bootstrap`:

| Member | Description |
| --- | --- |
| `me` | My peer id. |
| `create(draft, keyHash)` | Register, resolve with the `NetworkInfo`. Only `keyHash` (SHA-256 of the network key) is ever shown to a registry. |
| `join(network, request)` | Send `network.join` to an entry. Reject when it can't be found or reached. |
| `signal(peer, bytes)` | First contact. Return `false` when `peer` can't be reached this way. |
| `anchor?`, `unanchor?`, `update?` | Optional. Without them there are no anchors and no split healing. |
| `checksPassword?` | `true` when your registry already checked join passwords. |
| `close()` | |
| events | Dispatch `message` (`{ message, carrier }`) for anything that arrives, `anchors` (`{ network, anchors, target }`), and `lost` (the network closes on it). |

`Registry` from `@papit/peer-message` is the bookkeeping the signal server uses, ready for your own rendezvous. `MemoryServer` / `MemoryBootstrap` and `MemoryConnector` / `MemoryLink` run whole networks in one page, which is how the tests run.

# Media

The media plan lives in `NetworkInfo.media` ([shape and rules](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message#media-plan)). Set it in `create` or `update`, and use it through `network.media`:

```js
const call = await client.create({
    name: "call",
    topology: "mesh",
    media: {
        channels: { chat: { ordered: true }, state: { ordered: false, maxRetransmits: 0 } },
        streams: { camera: { kind: "video" }, mic: { kind: "audio" }, screen: { kind: "video" } },
    },
});

await call.media.start("camera");                                // getUserMedia({ video: true })
await call.media.start("screen");                                // getDisplayMedia, because of the name
await call.media.start("mic", { audio: { echoCancellation: true } });

call.media.addEventListener("stream", ({ detail }) => show(detail.peer, detail.name, detail.stream));
call.media.addEventListener("stream-ended", ({ detail }) => hide(detail.peer, detail.name));

const state = call.media.channel("state");
state.addEventListener("message", ({ detail }) => apply(detail.peer, detail.data));
state.broadcast(JSON.stringify({ x: 1 }));
```

```ts
class Media extends EventTarget {
    readonly plan: MediaPlan;
    start(name: string, source?: MediaStream | (MediaStreamConstraints & { display?: boolean })): Promise<MediaStream>;
    stop(name: string): void;
    streams(peer?: PeerId): Map<string, MediaStream>;     // remote streams from peer, or your captures
    channel(label: string): Channel;
}

class Channel extends EventTarget {
    readonly peers: PeerId[];                             // peers with this channel open
    send(peer: PeerId, data: string | Blob | ArrayBuffer | ArrayBufferView): boolean;
    broadcast(data): number;                              // how many peers it went to
    bufferedAmount(peer: PeerId): number;
    drain(peer: PeerId, below?: number): Promise<boolean>; // until at most `below` (1 MiB) is queued; false if it closes
}
```

| Event | Detail |
| --- | --- |
| `stream` / `stream-ended` | `{ peer, name, stream }` / `{ peer, name }`, remote |
| `capture` / `capture-ended` | `{ name, stream }` / `{ name }`, local (also when the user ends a screen share) |
| `channel-open` / `channel-close` | `{ peer, label }` |
| `message` (on a `Channel`) | `{ peer, data }`, raw, without peer-message framing |

- **Lazy slots.** Each link gets the plan before its first offer: one negotiated data channel per plan channel (ids 1, 2, … in label order, 0 is `_system`) and an empty transceiver per stream. Nothing is captured until `start()`, so no permission prompt shows before then. Offers map transceiver `mid` to stream name, which holds up against glare.
- **Channels are direct.** A `Channel` reaches linked peers only. Messages that arrive before the first `channel(label)` call are dropped. Labels starting with `_` are reserved.
- **Per-link narrowing.** A topology's `media(peer, plan)` can drop `streams` for one link. Channels always follow the full plan, because both ends have to agree on channel ids.
- **Relaying.** With `relay(name)`, a node without its own capture of `name` forwards the remote one from `relay(name)` on every link that narrowing allows. `multicast` relays from the parent, so the root's capture reaches every member. Every hop decodes and re-encodes the stream.
- **Mid-session changes.** `network.update({ media })` reaches every member. New channels open on the lowest free ids, removed ones close. New streams get slots, removed ones go inactive and their captures stop.

# Live testing with the demo

```bash
# terminal 1
npx papit-signal-server --port 3000

# terminal 2, in packages/network/webrtc
npm start
```

Open `/views/demo/` in two or more tabs. Each network gets a panel:

- **Create or join:** on the server, with a topology, anchors, beacon and password.
- **Send:** to everyone or to one peer.
- **Invite:** copy an invite to paste in another tab.
- **Carry a network over this one:** a network carried by `ParentBootstrap`.
- **Merge into:** another network id (anchors only).

`?url=` and `?join=<id>` prefill the form.

# Known limits

- Peers trust each other. In a topology that relays, any member can send under another's id; `mesh` (`direct`) drops those app messages.
- The `multicast` tree floods unicast, so a sibling link plus a back path can deliver a second copy. Only broadcasts are deduplicated.
- `media.refresh()` runs when a link opens or closes. A relay source that moves without a link change waits for the next link event.
- A link created while a media update is still in flight can end up with different channel ids on its two ends. Leave and rejoin to fix it.
- Remote streams are detected by track mute and unmute, so browsers that fire these late show streams late.
- Carried networks (`ParentBootstrap`) don't heal splits, and their invites stop working once every listed entry is gone.

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
  The signalling server and its registry.
