---
name: papit-network
description: Conventions for packages/network (@papit/webrtc in the browser, @papit/signal-server and @papit/meta-json in node). Covers the peer-to-peer topology model, the signalling protocol contract between client and server, binary encoding, resource cleanup (sockets, timers, listeners), and testing both sides. Load for any network work.
---

# Network

Load `papit-global` first.

## Packages
```
packages/network/webrtc          @papit/webrtc         browser: peer-to-peer with configurable topology
                                                       src/components/{socket,handshake,peer,message,network}
packages/network/signal-server   @papit/signal-server  node: signalling server for the WebRTC handshake (depends on `ws`)
packages/network/meta-json       @papit/meta-json      node + browser: binary container of two JSON objects (meta + payload)
```
webrtc depends on meta-json for message framing. signal-server and webrtc share a protocol. The message types are the **contract**, and changing one side means changing the other in the same branch.

## Principles
- **Protocol first.** The signalling message shapes live in `types.ts` on both sides. Keep them in sync and document them in both READMEs (a message table: type, direction, payload).
- **Clean up everything.** Every socket, `RTCPeerConnection`, data channel, listener and `setTimeout`/`setInterval` has an owner that releases it on `close()`.
- **Failure is normal.** Reconnect with backoff, time out handshakes, surface errors as events, and never throw from a network callback.
- **Untrusted input.** Validate every message from the wire (shape and size) before use.
- **Zero deps.** `ws` in signal-server is the one approved exception. Don't add more.

## Testing
- `signal-server`, `meta-json`: node:test. Spin the server up on an ephemeral port per test file and close it in `after()`. Test protocol messages, room/peer bookkeeping, disconnect cleanup and malformed input.
- `meta-json`: round-trip encode→decode for empty, unicode, large and nested payloads, plus corrupted buffers (truncated, wrong header).
- `webrtc`: Playwright (`tests/{socket,handshake,peer,message,network,webrtc}/`), served by `@papit/server` on :3500. Two pages/contexts act as two peers. Assert topology, message delivery and teardown. Keep them deterministic: await events, never sleep.

Current state: webrtc and signal-server have real suites. meta-json has a few. None of the three has a README beyond the scaffold template, which is the top docs priority here.

## Docs
Follow `papit-documentation`. Network READMEs add a protocol/message table and a lifecycle section (connect → handshake → open → close/reconnect).
