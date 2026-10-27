---
name: papit-network
description: Conventions for packages/network (@papit/webrtc in the browser, @papit/signal-server in node, @papit/peer-message and @papit/meta-json in both). Covers the peer-to-peer topology model, the signalling protocol contract between client and server, binary encoding, resource cleanup (sockets, timers, listeners), and testing both sides. Load for any network work.
---

# Network

Load `papit-global` first.

## Packages
```
packages/network/webrtc          @papit/webrtc         browser: peer-to-peer with configurable topology
                                                       src/components/{link,topology,network,socket,peer,handshake}
packages/network/signal-server   @papit/signal-server  node: relay node "server" + network registry (depends on `ws`)
packages/network/peer-message    @papit/peer-message   node + browser: the shared protocol (Meta, message types, guards, relay step)
packages/network/meta-json       @papit/meta-json      node + browser: binary container of two JSON objects (meta + payload)
```
meta-json frames bytes; peer-message defines what's inside and is the **contract** both signal-server and webrtc import. A protocol change goes into peer-message first, then into both sides in the same branch.

Model: every hop is a `Link` (socket or data channel). The server is just node `"server"` that forwards by `receiver`. Routing between peers is decided by a pluggable `Topology`.

## Principles
- **Protocol first.** Message shapes live only in peer-message. Its README holds the message table (type, direction, payload); the other READMEs point to it.
- **Clean up everything.** Every socket, `RTCPeerConnection`, data channel, listener and `setTimeout`/`setInterval` has an owner that releases it on `close()`.
- **Failure is normal.** Reconnect with backoff, time out handshakes, surface errors as events, and never throw from a network callback.
- **Untrusted input.** Validate every message from the wire (shape and size) before use.
- **Zero deps.** `ws` in signal-server is the one approved exception. Don't add more.

## Testing
- `signal-server`, `peer-message`, `meta-json`: node:test. Spin the server up on an ephemeral port (`listen(0)`) and close it in teardown. Test protocol messages, network bookkeeping, disconnect cleanup and malformed input.
- `meta-json`: round-trip encode→decode for empty, unicode, large and nested payloads, plus corrupted buffers (truncated, wrong header).
- `webrtc`: Playwright, served by `@papit/server` on :3500. Test routing and topologies over `MemoryLink` (in-memory transport, no RTC). Keep it light: real peer-to-peer is tested live by the owner through the `views/` demo. Await events, never sleep.

## Docs
Follow `papit-documentation`. Network READMEs add a protocol/message table and a lifecycle section (connect → handshake → open → close/reconnect).
