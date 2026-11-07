# @papit/box-intersection

Axis-aligned box intersection in 2D and 3D: AABB overlap, point-in-box and ray vs box. Reach for it as a fast first collision test.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/box-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/box-intersection)

---

# Installation

```bash
npm install @papit/box-intersection
```

# Usage

```ts
import { AABB, isPointInRectangle, rayBox } from "@papit/box-intersection";

AABB({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 });
// { x: 5, y: 5, w: 5, h: 5 }

isPointInRectangle({ x: 7, y: 7 }, { x: 0, y: 0, width: 10, height: 10 }); // true
```

Add `z` and `d` (or `depth`) and the same calls work in 3D:

```ts
import { AABB, rayBox } from "@papit/box-intersection";
import { Vector3 } from "@papit/vector";

const a = { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 };
const b = { x: 5, y: 5, z: 5, w: 10, h: 10, d: 10 };
AABB(a, b); // { x: 5, y: 5, w: 5, h: 5, z: 5, d: 5 }

const hit = rayBox(new Vector3(-5, 5, 5), new Vector3(1, 0, 0), a);
// { t: 5, point: Vector3(0, 5, 5), normal: Vector3(-1, 0, 0) }
```

# API

All functions are O(1).

### AABB

```ts
AABB(a: Rectangle, b: Rectangle): Overlap | false
```

The overlapping region as `{ x, y, w, h }` (plus `z, d` when both boxes are 3D), or `false`. Touching faces count as overlap with size 0. The output always uses the short size names.

### isPointInRectangle

```ts
isPointInRectangle(point: Point, box: Rectangle): boolean
```

Inside or on the edge. `z` is checked only when both the box and the point have one.

### rayBox

```ts
rayBox(origin: Point, direction: Point, box: Rectangle): { t, point, normal } | false
```

Slab test, 3D when the box has a `z`.

| Field | Description |
| --- | --- |
| `t` | distance in units of `direction`'s length: `point = origin + t * direction` |
| `point` | first hit, a `Vector2` or `Vector3` |
| `normal` | outward face normal at the hit |

A ray starting inside hits at `t = 0` with a zero normal. A zero `direction` only hits from inside.

## Types

```ts
type Rectangle = { x, y, w, h } | { x, y, width, height }   // plus optional z, d / depth
type Point = { x: number; y: number; z?: number }           // Vector2 / Vector3 fit
```

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

- [`@papit/circle-intersection`](https://www.npmjs.com/package/@papit/circle-intersection): circles and spheres
- [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk): rotated boxes and any other convex shape
- [`@papit/sat`](https://www.npmjs.com/package/@papit/sat): 2D polygons with contact normal
