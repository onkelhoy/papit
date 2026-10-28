# @papit/signal-server

WebSocket signalling server for @papit/webrtc. Reach for it to register and list networks, admit peers and forward their handshake messages until they connect directly.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-network-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/signal-server.svg?logo=npm)](https://www.npmjs.com/package/@papit/signal-server)

---

# Installation

```bash
npm install @papit/signal-server
```

Node >= 18. Depends on `ws` and `@papit/peer-message`, which defines the wire protocol.

# Usage

From the command line:

```bash
npx papit-signal-server --port 3000
```

In code, on your own HTTP server:

```js
import http from "node:http";
import { SocketServer } from "@papit/signal-server";

const server = http.createServer();
const wss = new SocketServer({ server });
server.listen(3000);

// later
wss.close();
```

With the built-in HTTP server (`GET /networks` included), configured from CLI flags:

```js
import { start, close } from "@papit/signal-server";

const server = start(); // http.Server
close();
```

# CLI flags

| Flag | Default | Description |
| --- | --- | --- |
| `--port` | `PORT` env, else `3000` | HTTP and WebSocket port |
| `--heartbeat-interval` | `2000` | ms between pings; a socket that misses one is terminated |
| `--forward-rate` | `200` | forwarded (peer → peer) messages per second, bursts up to the same amount; excess gets `rate` |
| `--spam-duration` | `200` | ms; a message to the server sooner than this after the previous one is a strike |
| `--spam-reset` | `1500` | ms of quiet that clears the strikes |
| `--max-strikes` | `3` | strikes before the socket is closed |
| `--max-payload` | `262144` | largest frame in bytes; bigger frames close the socket (1009) |

# API

## SocketServer

```ts
class SocketServer extends ws.WebSocketServer {
    constructor(options?: ServerOptions, callback?: () => void);
    sockets: Map<PeerId, Socket>;
    networks: Map<string, Network>;
    list(): NetworkInfo[];
    send(socket: Socket, type, payload, meta?): void;
    close(callback?): void;
}
```

| Member | Purpose |
| --- | --- |
| `list()` | Public networks without password hash or member list. Same as `GET /networks`. |
| `send(socket, type, payload, meta?)` | Send a server message (`sender: SERVER`, `receiver: socket.id`). Ignored when the socket isn't open. |
| `close()` | Terminate every client, stop the heartbeat, close the server. |

### ServerOptions

Everything from `ws.ServerOptions`, plus:

| Option | Default | Description |
| --- | --- | --- |
| `setClientID(request)` | `crypto.randomUUID()` | Id for a new socket. A reused id terminates the older socket, and the new one takes over its networks. |
| `pickEntry(network, members, newcomer)` | the host | Peer that receives a newcomer's `network.join`. `members` excludes the newcomer. |
| `maxPayload` | `MAX_MESSAGE_BYTES` | Passed to `ws`, and used as the `read` limit. |
| `forward_rate` | `200` | See CLI flags. |
| `heartbeat_interval` | `2000` | See CLI flags. |
| `spam_duration` | `200` | See CLI flags. |
| `spam_reset` | `1500` | See CLI flags. |
| `strikes` | `5` | See CLI flags (the CLI defaults to `3`). |

## start / close

```ts
function start(): http.Server;
function close(): void;
```

`start` reads the CLI flags and serves the following. The port is `--port`, else `process.env.PORT`, else 3000.

| Request | Response |
| --- | --- |
| WebSocket upgrade | the signalling socket |
| `GET /networks` | `200`, `NetworkInfo[]` as JSON |
| `GET /health` | `200`, `{ "ok": true }`, for health checks and for waking a sleeping host |
| `OPTIONS *` | `204` with CORS headers |
| anything else | `405` |

`close` is safe to call more than once. `SIGINT` calls it too.

## Types

`Socket` is a `ws.WebSocket` with `id`, `is_alive`, `strike`, `lastmessage` and `networks: Set<string>`. `Network` is a `NetworkInfo` plus `members: PeerId[]` (host included, oldest first) and an optional `passwordHash` (sha-256). Protocol types come from [@papit/peer-message](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message).

# Protocol

Only binary frames carrying a `@papit/peer-message` are accepted. The server's own messages have `sender: "server"` and `receiver` = the socket id.

| Type | Direction | Payload | Reply |
| --- | --- | --- | --- |
| `signal.welcome` | server → client | `{ id }` | sent on connect |
| `signal.register` | client → server | `{ name, topology, private?, password?, meta?, media? }` | `signal.registered { network }`, sender becomes host |
| `signal.update` | client → server | `{ network, name?, private?, password?, meta?, media? }` | `signal.updated { network }`, host only; `password: ""` removes it, a given `media` replaces the plan |
| `signal.unregister` | client → server | `{ network }` | none, host only |
| `signal.list` | client → server | `{}` | `signal.networks { networks }`, public only |
| `signal.join` | client → server | `{ network, password?, profile? }` | `network.join { profile? }` to the entry peer, `sender` = newcomer; the password is not passed on |
| `signal.leave` | client → server | `{ network }` | none; the network is deleted when the host leaves |
| `signal.host` | server → client | `{ network }` | you are now host |
| `signal.unreachable` | server → client | `{ receiver, ref }` | the message `ref` couldn't be delivered |
| `signal.error` | server → client | `{ code, message, ref? }` | see below |

`media` is the network's [media plan](https://github.com/onkelhoy/papit/tree/main/packages/network/peer-message#media-plan). The server validates and stores it, but doesn't interpret it. It goes out in `network` in `signal.registered`, `signal.updated`, `signal.networks` and `signal.host`, and is omitted when none was set. Peers learn about mid-session changes from the host through `network.media`, which the server forwards like any peer message.

| Error code | When |
| --- | --- |
| `invalid` | text frame (the socket is then closed), undecodable message, bad meta or bad reserved payload |
| `spoof` | `meta.sender` isn't the socket's id |
| `unsupported` | a non-`signal.*` (or server → client) type sent to the server, or `receiver: "*"` |
| `forbidden` | update/unregister by a non-host, a wrong password on join, or a `signal.*` message sent to a peer |
| `rate` | a forwarded message over the `forward_rate` budget; it is dropped, the socket stays open |
| `not-found` | unknown network |

## Forwarding

A message with any other `receiver` is passed to that socket:

1. `receiver === "server"` → handled as above. A `signal.*` type to anyone else → `forbidden`. `receiver === "*"` → `unsupported`, the server doesn't fan out.
2. `relay(meta, "server")` from peer-message: `"server"` is added to `hops` and one `ttl` is spent. A spent `ttl` drops the message.
3. The receiver's socket exists → it gets the re-encoded message. Otherwise the sender gets `signal.unreachable`.

The server never rewrites `sender`, so receivers can trust it, and only the server sends `signal.*` messages to clients.

Limits are split by traffic: messages to the server (and undecodable frames) go through the spam check, which closes the socket after too many strikes. Forwarded messages spend a per-socket token bucket instead (`forward_rate`, refilled on each message), so a burst of ICE candidates is fine.

# Lifecycle

```
connect ──▶ signal.welcome {id}
  ├─ host:    signal.register ──▶ signal.registered
  └─ joiner:  signal.list ──▶ signal.networks
              signal.join ──▶ server checks password, adds member ──▶ network.join to entry peer
forward:    network.* / handshake.* / app messages, peer → server → peer
close:      socket closes or sends signal.leave
              └─ host left, or no members remain ──▶ network deleted (the peers pick a new host, which registers again)
heartbeat:  ping every interval; no pong by the next one ──▶ terminated, same as close
spam:       too many strikes on server traffic ──▶ closed (1008)
rate:       forwarded traffic over forward_rate ──▶ dropped, signal.error {code: "rate"}
```

# Deploy on Render

These notes follow Render's usual setup for a Node web service. Check Render's own docs for the current details.

1. Create a **Web Service** (not a static site or background worker). WebSockets need a service that keeps a process running.
2. Commands:
   - once `@papit/signal-server` is published: build `npm install @papit/signal-server`, start `npx papit-signal-server`
   - from this monorepo: build `npm install && npm run build`, start `node packages/network/signal-server/lib/bin.js`
3. Leave the port alone. Render sets the `PORT` environment variable and the server listens on it. Don't pass `--port` there.
4. Set the **health check path** to `/health`.
5. Connect clients to `wss://<app>.onrender.com`. Render terminates TLS, so the client uses `wss://` while the server itself speaks plain `ws`.

On the free tier, Render spins an idle service down, and the first request after that waits for a cold start, which can take tens of seconds. `@papit/webrtc`'s `Client` deals with it: it keeps retrying the socket, pings `https://<app>.onrender.com/health` to start the boot, and reports `client.status === "waking"` meanwhile. A sleeping server loses all networks, since they live only in memory.

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
  The message format and protocol types.
- [@papit/webrtc](https://github.com/onkelhoy/papit/tree/main/packages/network/webrtc)
  The browser client.
