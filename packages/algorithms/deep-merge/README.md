# @papit/deep-merge

Recursively merges objects left to right, with later values winning. Use it to layer options, config or overrides onto defaults.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/deep-merge.svg?logo=npm)](https://www.npmjs.com/package/@papit/deep-merge)

---

# Installation

```bash
npm install @papit/deep-merge
```

# Usage

```js
import { deepMerge } from "@papit/deep-merge";

const defaults = { size: "m", colors: { fg: "black", bg: "white" } };
const config = deepMerge(defaults, { colors: { bg: "grey" } });
// { size: "m", colors: { fg: "black", bg: "grey" } }
```

Any number of objects, applied in order:

```js
deepMerge({ a: 1, n: { x: 1 } }, { n: { y: 2 } }, { a: 3, n: { x: 9 } });
// { a: 3, n: { x: 9, y: 2 } }
```

Merge two objects and skip some top-level keys:

```js
import { deepMergeTwo } from "@papit/deep-merge";

deepMergeTwo({ id: 1, name: "a" }, { id: 2, name: "b" }, ["id"]);
// { id: 1, name: "b" }
```

# API

### `deepMerge`

```ts
function deepMerge<T = any>(...objects: Partial<T>[]): T
```

Merges every object into a new `{}`, left to right. Inputs are not mutated.

### `deepMergeTwo`

```ts
function deepMergeTwo<T = any>(a: Partial<T>, b: Partial<T>, omit?: string[]): T
```

Merges `b` into a shallow copy of `a`. Keys in `omit` are skipped at the top level only.

### Merge rules

For each key of the later object (`for...in`, so inherited enumerable keys count too):

| Later value | Earlier value | Result |
| --- | --- | --- |
| object (not array) | object (including `null` and arrays) | merged recursively into a plain object |
| object (not array) | anything else | the later object, by reference |
| array | anything | the later array, replaced by reference, not concatenated |
| `null` | anything | `null` |
| `undefined` | anything | `undefined` (the key is kept, set to `undefined`) |
| primitive | anything | the primitive |

### Edge cases

- **Shared references.** Values taken over unchanged (arrays, and objects with no counterpart) aren't cloned. Mutating the result can mutate an input.
- **Class instances.** Taken over as is when there's nothing to merge into. When they are merged into an existing object, the result is a plain object: the prototype, getters and methods are lost. A `Date`, `Map` or `Set` merged into an existing object is dropped, because it has no enumerable keys.
- **Object over array.** The array's indices become keys: `{ a: [1, 2] }` + `{ a: { x: 1 } }` gives `{ a: { 0: 1, 1: 2, x: 1 } }`.
- **Prototype keys.** `__proto__`, `constructor` and `prototype` are skipped at every level, so input like `JSON.parse('{"__proto__": {...}}')` can't change the result's prototype.

# Complexity

| Operation | Time | Space |
| --- | --- | --- |
| `deepMerge(...objects)` | O(total keys across all objects) | O(keys in the result) |
| `deepMergeTwo(a, b)` | O(keys of `a` + keys of `b`, recursively) | O(keys of `a` + keys of `b`) |

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.
