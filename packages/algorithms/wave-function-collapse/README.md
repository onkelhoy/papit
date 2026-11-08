# @papit/wave-function-collapse

A seeded wave function collapse solver over any graph: slots, options, weights and a compatibility rule. Reach for it to pick tiles, modules or variants so neighbours always fit.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/wave-function-collapse.svg?logo=npm)](https://www.npmjs.com/package/@papit/wave-function-collapse)

---

# Installation

```bash
npm install @papit/wave-function-collapse
```

# Usage

Describe the problem with callbacks: how many slots, how many options each, who neighbours whom, and which options fit side by side.

```typescript
import { solve } from "@papit/wave-function-collapse";
import { Random } from "@papit/random";

// a row of 10 tiles, neighbours may differ by at most 1 (0 water, 1 sand, 2 grass)
const { assignment, conflicts } = solve({
    slotCount: 10,
    options: () => 3,
    links: (s) => [s - 1, s + 1].filter((n) => n >= 0 && n < 10).map((slot) => ({ slot, side: 0 })),
    compatible: (s, option, link, other) => Math.abs(option - other) <= 1,
}, { random: new Random("beach") });
```

Re-solve only part of it, keeping the rest:

```typescript
solve(problem, { random, region: [4, 5], fixed: assignment });
```

# API

## solve

```typescript
solve(problem: Problem, options: SolveOptions): Solution
```

| Problem | Description |
| --- | --- |
| `slotCount` | Number of slots |
| `options(slot)` | Number of options for a slot, options are `0..n-1` |
| `weight(slot, option)` | Optional relative chance, default 1 |
| `links(slot)` | Neighbours as `{ slot, side }`, `side` is yours to define (edge index, up, down) |
| `compatible(slot, option, link, other)` | Can `option` sit beside `other` at `link.slot` across `link.side` |

| Option | Description |
| --- | --- |
| `random` | A `@papit/random` instance, same seed gives the same result |
| `region` | Slots to solve, default all |
| `fixed` | Option per slot outside the region, -1 for none |

| Solution | Description |
| --- | --- |
| `assignment` | `Int32Array`, option per slot, -1 when a slot has no options |
| `conflicts` | Slots where no option fit; they got a weighted pick ignoring neighbours |

# Design notes

- Lowest remaining option count is collapsed first, ties go to the lowest slot index, so results are deterministic.
- Arc consistency propagation after each collapse. Cost is about O(slots * options² * links) in the worst case; fine for thousands of slots, not millions.
- No backtracking yet: an impossible spot is filled anyway and reported in `conflicts`, so a solve always finishes.
- The solver knows nothing about tiles or grids, so it fits square tiles, irregular grids, 3D slabs or graphs.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/random](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/random)
- [@papit/structure](https://github.com/onkelhoy/papit/tree/main/packages/game/structure)
