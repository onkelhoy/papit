# @papit/meta-json

Binary container that packs a JSON metadata object and a payload into one buffer. Reach for it when a router or relay needs to read message metadata without parsing the payload.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-network-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/meta-json.svg?logo=npm)](https://www.npmjs.com/package/@papit/meta-json)

---

# Installation

```bash
npm install @papit/meta-json
```

Runs in node (>= 18) and the browser. No dependencies.

# Usage

```js
import { MetaJson } from "@papit/meta-json";

const message = MetaJson.Create({ type: "chat" }, JSON.stringify({ text: "hej" }));
const bytes = message.toBinary(); // Uint8Array

// on the other side
const received = MetaJson.FromBinary(bytes);
received.meta.type;  // "chat", payload not parsed yet
received.parse();    // { text: "hej" }
```

The payload can be a string (encoded as UTF-8) or binary: a `Uint8Array`, an `ArrayBuffer` or any other view such as a `DataView`. A view contributes only its own `byteOffset`/`byteLength` range. Anything else goes through `String()`, so an object becomes `"[object Object]"`. Stringify it first.

```js
const image = new Uint8Array(await blob.arrayBuffer());
const bytes = MetaJson.Create({ type: "image" }, image).toBinary();

MetaJson.FromBinary(bytes).payload; // Uint8Array, byte-exact
```

A relay can change `meta` and forward the payload without ever parsing it:

```js
const msg = MetaJson.FromBinary(bytes);
msg.meta.hops.push("me");
send(msg.toBinary(true)); // re-encoded meta, same payload bytes
```

Low-level, without the class:

```js
import { Codec } from "@papit/meta-json";

const bytes = Codec.Encode({ meta: { to: "peer-b" }, payload: JSON.stringify([1, 2, 3]) });

Codec.Decode(bytes).meta;         // { to: "peer-b" }
Codec.Decode(bytes).payload;      // Uint8Array view of the payload bytes
Codec.Decode(bytes, true).payload; // [1, 2, 3]
```

Extend `MetaJson` for typed messages. `Create` and `FromBinary` return the subclass:

```js
import { MetaJson } from "@papit/meta-json";

class Message extends MetaJson {}

const msg = Message.FromBinary(Message.Create({ type: "ping" }, "{}").toBinary());
msg instanceof Message; // true
```

# API

## MetaJson

```ts
class MetaJson<Meta extends Object = object, Payload = any> {
    constructor(meta: Meta, payload: Payload | BufferSource);
    meta: Meta;
    payload: Payload | BufferSource;
    toBinary(force?: boolean): Uint8Array;
    parse<T extends Payload = Payload>(): T;
    static Create(meta, payload): MetaJson;
    static FromBinary(data: Uint8Array, parsePayload?: boolean): MetaJson;
}
```

| Member | Purpose |
| --- | --- |
| `Create(meta, payload)` | Same as `new this(meta, payload)`, typed to return the subclass. Adds nothing to `meta`. |
| `FromBinary(data, parsePayload?)` | Decode a buffer. `meta` is parsed, the payload stays bytes unless `parsePayload` is true. |
| `toBinary(force?)` | Encode. Cached after the first call; pass `true` to re-encode after changing `meta` or `payload`. |
| `parse()` | `JSON.parse` the payload bytes once, then return the cached value. A non-binary payload is returned as it is. |

## Codec

```ts
class Codec {
    static Encode(message: MessageType): Uint8Array;
    static Decode(data: Uint8Array, parsePayload?: boolean): MessageType;
    static Parse<T>(bytes: BufferSource): T;
}
```

| Method | Purpose |
| --- | --- |
| `Encode` | Pack `{ meta, payload }` into one buffer. Binary payloads are copied as their bytes, strings as UTF-8. |
| `Decode` | Unpack. The payload is a zero-copy `subarray` of `data` unless `parsePayload` is true. `data` may itself be a subarray of a bigger buffer. |
| `Parse` | UTF-8 decode and `JSON.parse` a buffer. A view reads only its own byte range. |

### Errors

| Error | Thrown by | When |
| --- | --- | --- |
| `RangeError` | `Decode`, `FromBinary` | The buffer is shorter than the 4-byte header. |
| `RangeError` | `Decode`, `FromBinary` | The header's meta length is larger than the bytes after the header (truncated buffer). |
| `SyntaxError` | `Decode`, `FromBinary` | The meta section is not valid JSON. |
| `SyntaxError` | `Decode(data, true)`, `parse()`, `Parse` | The payload is not valid JSON. |

## Types

| Type | Shape |
| --- | --- |
| `MessageType<Meta, Payload>` | `{ meta: Meta; payload: Payload }` |
| `BufferSource` | `ArrayBuffer \| ArrayBufferView` |

# Binary layout

```
offset 0          4                  4 + N
       ┌──────────┬──────────────────┬───────────────────┐
       │ N (u32)  │ meta JSON, UTF-8 │ payload bytes     │
       │ big-end. │ N bytes          │ rest of buffer    │
       └──────────┴──────────────────┴───────────────────┘
```

- The header is the byte length of the meta section, unsigned 32-bit big-endian.
- The payload has no length of its own. It runs to the end of the buffer.
- Reading `meta` only decodes the first `4 + N` bytes. That is the point: a relay can route on `meta` and forward the payload untouched.
- There is no magic number, version or checksum. `Decode` checks only that the header fits the buffer, so validate the decoded `meta` from the wire.

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

- [@papit/webrtc](https://github.com/onkelhoy/papit/tree/main/packages/network/webrtc)
  Peer-to-peer networking. Its `Message` class extends `MetaJson`.
