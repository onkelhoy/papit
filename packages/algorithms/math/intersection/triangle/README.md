# @papit/triangle-intersection

Triangle tests: point-in-triangle in 2D, closest point on a triangle and ray vs triangle in 3D. Reach for it for mesh picking and point-to-mesh distance.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/triangle-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/triangle-intersection)

---

# Installation

```bash
npm install @papit/triangle-intersection
```

# Usage

```ts
import { isPointInTriangle, closestPointOnTriangle, rayTriangle } from "@papit/triangle-intersection";

isPointInTriangle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }); // true

const a = { x: 0, y: 0, z: 0 }, b = { x: 1, y: 0, z: 0 }, c = { x: 0, y: 1, z: 0 };

closestPointOnTriangle({ x: 0.2, y: 0.2, z: 3 }, a, b, c);
// { point: Vector3(0.2, 0.2, 0), distance: 3 }

rayTriangle({ x: 0.2, y: 0.2, z: 1 }, { x: 0, y: 0, z: -1 }, a, b, c);
// { t: 1, u: 0.2, v: 0.2, point: Vector3(0.2, 0.2, 0) }
```

# API

All functions are O(1).

### isPointInTriangle

```ts
isPointInTriangle(p: VectorValue, a: VectorValue, b: VectorValue, c: VectorValue): boolean
```

2D, edges included. Throws when not given exactly three corners.

### closestPointOnTriangle

```ts
closestPointOnTriangle(p: Point, a: Point, b: Point, c: Point): { point, distance }
```

Ericson 5.1.5: finds which vertex, edge or face region `p` projects into. 2D or 3D. A degenerate (flat) triangle still returns a point on it.

### rayTriangle

```ts
rayTriangle(origin: Point, direction: Point, a: Point, b: Point, c: Point): { t, u, v, point } | false
```

Möller–Trumbore, two-sided. `point = origin + t * direction`, `u`, `v` are the barycentric weights of `b` and `c`. `false` on a miss, a parallel ray or a degenerate triangle.

## Types

```ts
type Point = { x: number; y: number; z?: number }   // Vector2 / Vector3 fit
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

- [`@papit/line-intersection`](https://www.npmjs.com/package/@papit/line-intersection): segments and planes
- [`@papit/polygon-intersection`](https://www.npmjs.com/package/@papit/polygon-intersection): point in polygon
