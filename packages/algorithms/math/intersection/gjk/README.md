# @papit/gjk

GJK collision for convex shapes in 2D and 3D: overlap, distance and penetration depth (EPA). Reach for it when shapes are not boxes or circles, or when you need 3D.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/gjk.svg?logo=npm)](https://www.npmjs.com/package/@papit/gjk)

---

# Installation

```bash
npm install @papit/gjk
```

# Usage

```ts
import { gjk, distance, penetration, sphereSupport, boxSupport } from "@papit/gjk";

const ball = sphereSupport({ x: 0, y: 0, z: 0, r: 1 });
const crate = boxSupport({ x: 0.5, y: -1, z: -1, w: 2, h: 2, d: 2 });

gjk(ball, crate);         // true
penetration(ball, crate); // { normal: Vector3(1, 0, 0), depth: 0.5 }

distance(ball, boxSupport({ x: 3, y: -1, z: -1, w: 2, h: 2, d: 2 }));
// { distance: 2, pointA: Vector3(1, 0, 0), pointB: Vector3(3, 0, 0) }
```

Any object with a `support` method is a shape, so your own vectors work directly:

```ts
import { gjk, hullSupport } from "@papit/gjk";
import { Vector3 } from "@papit/vector";

const center = new Vector3(0, 0, 0);
const ball = {
    support(direction) {
        const d = new Vector3(direction);
        d.magnitude = 1;
        return new Vector3(center.x + d.x, center.y + d.y, center.z + d.z);
    },
};
gjk(ball, hullSupport([new Vector3(0.5, 0, 0), new Vector3(3, 0, 0)])); // true
```

2D works the same, leave out `z`. An array is a concave shape made of convex pieces:

```ts
import { gjk, boxSupport, hullSupport } from "@papit/gjk";

const L = [boxSupport({ x: 0, y: 0, w: 1, h: 3 }), boxSupport({ x: 0, y: 0, w: 3, h: 1 })];
gjk(L, hullSupport([[2, 2]])); // false, the inner corner is empty
gjk(L, hullSupport([[2.5, 0.5]])); // true
```

Moved, rotated or rounded shapes:

```ts
import { gjk, boxSupport, transformed, translated, margin } from "@papit/gjk";
import { Matrix4 } from "@papit/matrix";

const unit = boxSupport({ x: -1, y: -1, z: -1, w: 2, h: 2, d: 2 });
const spun = transformed(unit, new Matrix4().rotate(Math.PI / 4, [0, 1]));
const moved = translated(unit, { x: 2.2, y: 0, z: 0 });
gjk(unit, moved); // false
gjk(spun, moved); // true, the rotated corner reaches x ≈ 1.41
gjk(margin(unit, 0.5), moved); // true
```

# API

`n`: points in a hull. GJK takes a handful of iterations (max 64), EPA up to 256 expansions.

### gjk

```ts
gjk(a: Shape, b: Shape): boolean
```

Whether the shapes overlap. Touching counts. O(iterations) per pair of pieces.

### distance

```ts
distance(a: Shape, b: Shape): { distance, pointA, pointB } | false
```

The gap and the closest point on each shape (`Vector2` or `Vector3`). `false` when they overlap or touch. Arrays: the closest pair of pieces.

### penetration

```ts
penetration(a: Shape, b: Shape): { normal, depth } | false
```

EPA on the final GJK simplex: polygon expansion in 2D, polytope expansion in 3D. Move `b` by `normal * depth` to separate them. `normal` is a unit vector from `a` towards `b`. Depth 0 when touching, `false` when apart. Arrays: the deepest overlapping pair.

### Support helpers

Each returns a `Convex`. Its `support` answers in one reused `Vector2` / `Vector3` (no allocation per call),
so copy the result if you keep it past the next call.

| Function | Shape | Cost per support |
| --- | --- | --- |
| `sphereSupport(sphere)` | circle `{ x, y, r }`, sphere with `z` | O(1) |
| `boxSupport(box)` | axis-aligned box from its min corner, `w/h/d` or `width/height/depth` | O(1) |
| `capsuleSupport(capsule)` | segment `a`–`b` swept by `r` | O(1) |
| `hullSupport(points)` | convex hull of points, interior ones are ignored. Throws on `[]` | O(n) |
| `translated(shape, offset)` | `shape` moved by `offset` | + O(1) |
| `transformed(shape, matrix)` | `shape` under a column-major 3x3 (2D) or 4x4 (3D) matrix, e.g. `Matrix3` / `Matrix4`. Throws on other sizes | + O(1) |
| `margin(shape, r)` | `shape` grown by `r` on every side | + O(1) |

## Types

```ts
type Convex = { support(direction: VectorValue): VectorValue }
type Shape = Convex | Convex[]
```

`support` gets a reused `Vector3` direction (`z` is 0 in 2D) and returns the shape's furthest point along it: a `Vector2` / `Vector3`, `{ x, y, z? }` or `[x, y, z?]`. Points without `z` make the query 2D. `@papit/game-shape` shapes have `support` and fit.

# Design notes

- **Allocation-free solver:** GJK and EPA work on numbers in scratch buffers; only the result allocates. Support helpers return a small object per call.
- **Precision:** gaps under 1e-7 of the shapes' size count as touching. Curved shapes (spheres, capsules, margins) resolve contact to about 1e-6.
- **Boxes and circles only?** `@papit/box-intersection` and `@papit/circle-intersection` are cheaper.

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

- [`@papit/vector`](https://www.npmjs.com/package/@papit/vector): the vectors in and out
- [`@papit/matrix`](https://www.npmjs.com/package/@papit/matrix): transforms for `transformed`
- [`@papit/sat`](https://www.npmjs.com/package/@papit/sat): 2D polygons
- [`@papit/game-shape`](https://www.npmjs.com/package/@papit/game-shape): shapes that plug straight in
