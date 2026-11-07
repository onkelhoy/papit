# @papit/circle-intersection

Circle and sphere intersection in 2D and 3D: where two circles cross, overlap with normal and depth, point inside and ray vs circle. Reach for it for round colliders and picking.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/circle-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/circle-intersection)

---

# Installation

```bash
npm install @papit/circle-intersection
```

# Usage

```ts
import { CircleIntersection, CircleOverlap, isPointInCircle } from "@papit/circle-intersection";

CircleIntersection({ x: 0, y: 0, r: 5 }, { x: 6, y: 0, r: 5 });
// va (3, -4), vb (3, 4), chord midpoint vc (3, 0), a: 3, h: 4

CircleOverlap({ x: 0, y: 0, r: 5 }, { x: 6, y: 0, r: 5 });
// { normal: Vector2(1, 0), depth: 4 }

isPointInCircle({ x: 3, y: 4 }, { x: 0, y: 0, radius: 5 }); // true
```

Add `z` to make it a sphere:

```ts
import { CircleOverlap, rayCircle } from "@papit/circle-intersection";
import { Vector3 } from "@papit/vector";

const sphere = { x: 0, y: 0, z: 0, r: 1 };
CircleOverlap(sphere, { x: 0, y: 0, z: 1.5, r: 1 });
// { normal: Vector3(0, 0, 1), depth: 0.5 }

rayCircle(new Vector3(0, 0, -5), new Vector3(0, 0, 1), sphere);
// { t: 4, point: Vector3(0, 0, -1), normal: Vector3(0, 0, -1) }
```

# API

All functions are O(1).

### CircleIntersection

```ts
CircleIntersection(a: Circle, b: Circle): { va, vb, vc, a, h } | false
```

The two crossing points of two 2D circles (radical-line method). `false` when apart, concentric or one contains the other.

| Field | Description |
| --- | --- |
| `va`, `vb` | the crossing points, equal when tangent |
| `vc` | midpoint of the chord, on the center-to-center line |
| `a` | distance from `a`'s center to `vc` |
| `h` | half the chord length |

### CircleOverlap

```ts
CircleOverlap(a: Circle, b: Circle): { normal, depth } | false
```

Overlap of two circles or spheres (3D when either has a `z`). `normal` is the unit vector from `a` towards `b` (`+x` when concentric), `depth` how far they overlap. Touching gives depth 0.

### isPointInCircle

```ts
isPointInCircle(point: Point | VectorValue, circle: Circle): boolean
```

Inside or on the boundary. 3D when the circle has a `z`.

### rayCircle

```ts
rayCircle(origin: Point, direction: Point, circle: Circle): { t, point, normal } | false
```

First hit on the surface, `point = origin + t * direction`, `normal` outward. A ray starting inside hits at `t = 0` with a zero normal.

## Types

```ts
type Circle = { x, y, r } | { x, y, radius }   // plus optional z
type Point = { x: number; y: number; z?: number }
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

- [`@papit/box-intersection`](https://www.npmjs.com/package/@papit/box-intersection): boxes
- [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk): spheres against any convex shape
