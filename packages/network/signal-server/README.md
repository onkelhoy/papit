# @papit/signal-server

WebSocket signalling server for @papit/webrtc with built-in web push. Reach for it to register and list networks, admit peers, forward their handshake messages until they connect directly, and wake offline users without storing anything.

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
| `--allow-origin` | any | CORS origins, comma separated |
| `--no-push` | push on | turns the push routes off |
| `--generate-vapid` | | prints a VAPID key pair and exits |
| `--vapid-subject` | `VAPID_SUBJECT` env, else the papit repo | `mailto:` or `https:` contact shown to push services |
| `--push-rate` | `60` | POST requests per minute per client address, bursts up to the same amount; `0` turns the limit off |
| `--trust-proxy` | off | number of proxies in front of the server, a bare flag means 1; see [Client address](#client-address) |
| `--allow-private` | off | lets pushes reach private addresses, see [Private networks](#private-networks) |

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
| `/push/*` | see [Web push](#web-push) |
| `OPTIONS *` | `204` with CORS headers |
| anything else | `405` |

`start` throws on bad push config: only one VAPID key set, keys that aren't a pair, or a bad subject. `close` is safe to call more than once. `SIGINT` calls it too.

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

# Web push

Wakes a user whose app is closed, so they can come online and connect. The server stores nothing: it encrypts a browser's push subscription into a token and hands it back. Apps keep tokens on their own devices, so a token works after a restart or a sleep, and with no network open at all.

Whoever holds a token can push to that browser. The server has no idea who a user is, and there is no lookup by user id. How tokens travel is up to the app: a peer profile, a link, a QR code.

## Keys

Browsers tie a subscription to a VAPID key pair. Generate one once and keep it, because new keys void every subscription and token.

```bash
npx @papit/signal-server --generate-vapid
```

Set the output as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in the environment. They are env only, and the private key must never be committed. Without them the server makes throwaway keys at start and warns: push works, but every token dies on restart.

## Routes

| Request | Body | Response |
| --- | --- | --- |
| `GET /push/key` | | `{ key, persistent }`, the key for `pushManager.subscribe`; `persistent` is false with throwaway keys |
| `POST /push/subscribe` | `{ subscription }` | `{ token }` |
| `POST /push/send` | `{ token, payload, ttl?, urgency? }` | `{ status }` |

`payload` is any JSON up to 3993 bytes. The app decides what it means, so a call, a cancel and a decline are all just pushes. `ttl` is in seconds (default `60`, at most 28 days), and `urgency` is `very-low`, `low`, `normal` or `high` (default `high`).

| Status | Meaning |
| --- | --- |
| `sent` | the push service took it |
| `gone` | the subscription is dead for good, drop the token |
| `failed` | try again later |

Errors are `{ error }`: `400` bad input, `413` too large, `429` over `--push-rate`.

## Usage

In the browser, from a user tap (iOS requires it) and with a service worker registered:

```js
const server = "https://<app>.onrender.com";
const { key } = await (await fetch(`${server}/push/key`)).json();

const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

const response = await fetch(`${server}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
});
const { token } = await response.json();
```

From anyone holding the token:

```js
await fetch(`${server}/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, payload: { type: "call", from: "Ada" } }),
});
```

In the service worker, always show a notification. Browsers require it:

```js
self.addEventListener("push", (event) => {
    const { from } = event.data.json();
    event.waitUntil(self.registration.showNotification(`Incoming call from ${from}`));
});
```

Refresh the token on app load, because a subscription can change.

## Testing on devices

Check these by hand, because automated tests only reach a local push service. Serve the app over https.

| Device | Notes |
| --- | --- |
| Android Chrome | works in a tab; close the app, then send |
| Desktop | the browser must be running for a push to arrive |
| iOS 16.4+ | only in a PWA installed to the home screen, and notification actions are ignored |

## Client address

`--push-rate` counts per client address. Behind proxies every request comes from the last proxy, so `--trust-proxy <hops>` reads that many entries from the end of `x-forwarded-for`. Entries further left are whatever the client sent. Too low and users share one limit; too high and clients can fake their address. Without a proxy, leave it off.

## Private networks

By default pushes only go to https endpoints on public hosts, and a subscription pointing at `localhost`, an IP address or a private range is refused. Otherwise anyone could make a public server call its own internal network.

`--allow-private` lifts this, including http, for a server inside a private network. Never use it on a public server. Redirects are never followed either way. The browser picks the push service, so a closed network still needs a self-hosted service and a browser that can use it.

## Exports

The pieces behind the routes, for your own HTTP server:

| Export | Purpose |
| --- | --- |
| `createPushRoutes(config)` | `{ handle(request, response, pathname, headers), close() }`, config is `PushConfig` |
| `generateVapidKeys()`, `validateVapidKeys(keys)` | create and check a key pair |
| `sealSubscription(subscription, keys)`, `openSubscription(token, keys)` | subscription to token and back; `openSubscription` returns null on a bad token |
| `sendPush(subscription, payload, keys, subject, options?)` | sends one push, resolves to a status, never throws |
| `parseSubscription(value, allowPrivate?)`, `isPublicEndpoint(endpoint, lookup?)` | validate untrusted input |
| `RateLimiter`, `clientAddress(request, trustProxy?)` | the limiter behind `--push-rate` |
| `encryptPush(payload, subscription)`, `vapidAuthorization(endpoint, keys, subject)`, `MAX_PUSH_BYTES` | the raw protocol, RFC 8291 and RFC 8292 |

# Deploy on Render

These notes follow Render's usual setup for a Node web service. Check Render's own docs for the current details.

1. Create a **Web Service** (not a static site or background worker). WebSockets need a service that keeps a process running.
2. Commands:
   - once `@papit/signal-server` is published: build `npm install @papit/signal-server`, start `npx papit-signal-server`
   - from this monorepo: build `npm install && npm run build`, start `node packages/network/signal-server/lib/bin.js`
3. Leave the port alone. Render sets the `PORT` environment variable and the server listens on it. Don't pass `--port` there.
4. Set the **health check path** to `/health`.
5. Connect clients to `wss://<app>.onrender.com`. Render terminates TLS, so the client uses `wss://` while the server itself speaks plain `ws`.
6. For web push, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` under **Environment**, and add `--trust-proxy <hops>` to the start command. Check `x-forwarded-for` on a real request to find the hop count, it depends on Render's current setup.

On the free tier, Render spins an idle service down, and the first request after that waits for a cold start, which can take tens of seconds. `@papit/webrtc`'s `Client` deals with it: it keeps retrying the socket, pings `https://<app>.onrender.com/health` to start the boot, and reports `client.status === "waking"` meanwhile. A sleeping server loses all networks, since they live only in memory. Push tokens survive it: a `/push/send` wakes the server, so it answers after the cold start.

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
