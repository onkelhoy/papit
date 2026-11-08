# @papit/random

Seeded random numbers that replay the same sequence from the same seed, with independent forked streams. Reach for it when procedural content or multiplayer games must be deterministic.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/random.svg?logo=npm)](https://www.npmjs.com/package/@papit/random)

---

# Installation

```bash
npm install @papit/random
```

# Usage

```typescript
import { Random } from "@papit/random";

const rng = new Random("island-7");
rng.next();               // float in [0, 1)
rng.int(0, 6);            // 0..5
rng.pick(["oak", "pine"]);
rng.weighted(["wall", "arch"], [3, 1]);
```

Give each chunk its own stream, so the result does not depend on generation order:

```typescript
const chunk = rng.fork("chunk:3,4");
```

Save or sync the position:

```typescript
const saved = rng.state;
rng.state = saved;
```

# API

## Random

```typescript
new Random(seed?: number | string)
```

| Member | Returns | Description |
| --- | --- | --- |
| `seed` | `number` | Hashed seed |
| `uint()` | `number` | Unsigned 32 bit integer |
| `next()` | `number` | Float in [0, 1) |
| `float(min?, max?)` | `number` | Float in [min, max) |
| `int(min, max)` | `number` | Integer in [min, max), `min` when `max <= min` |
| `chance(p)` | `boolean` | True with probability `p` |
| `pick(items)` | `T \| undefined` | Random element, `undefined` when empty |
| `weightedIndex(weights)` | `number` | Index by weight, -1 when all weights are 0 or less |
| `weighted(items, weights)` | `T \| undefined` | Element by weight |
| `shuffle(items)` | `T[]` | Fisher-Yates, in place |
| `fork(key)` | `Random` | Independent stream from `seed` + `key`, leaves this one untouched |
| `state` | `[n, n, n, n]` | Get or set the position |

## hash

```typescript
hash(seed: number | string): number
```

32 bit hash. Unsigned 32 bit integers pass through unchanged.

# Design notes

- sfc32 with splitmix32 seeding: fast, 128 bit state, only 32 bit integer math, so output is identical on every engine.
- The sequence is pinned by tests. Changing it would break saved worlds and multiplayer.
- All calls are O(1), except `weighted` and `shuffle`, which are O(n). Nothing allocates per call except `fork`.
- Not cryptographic. Use `crypto.getRandomValues` for secrets.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.
