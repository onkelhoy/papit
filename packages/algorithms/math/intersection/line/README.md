# @papit/line-intersection

Line and segment intersection in 2D, closest points between segments and ray vs plane in 3D. Reach for it for line-of-sight, picking and capsule tests.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/line-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/line-intersection)

---

# Installation

```bash
npm install @papit/line-intersection
```

# Usage

```ts
import { SegmentIntersection, closestSegmentPoints, rayPlane } from "@papit/line-intersection";

SegmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
// { x: 5, y: 5, t: 0.5, u: 0.5 }

// two skew segments in 3D
closestSegmentPoints({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 });
// { s: 0.5, t: 0.5, a: Vector3(1, 0, 0), b: Vector3(1, 0, 1), distance: 1 }

rayPlane({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, { normal: { x: 0, y: 1, z: 0 }, d: 0 });
// { t: 5, point: Vector3(0, 0, 0) }
```

# API

All functions are O(1).

### LineIntersection

```ts
LineIntersection(p1, p2, p3, p4): { x, y, t, u } | false
```

Where infinite line `p1`–`p2` crosses line `p3`–`p4` (2D). `t` and `u` are the positions along each, `false` when parallel.

### SegmentIntersection

```ts
SegmentIntersection(p1, p2, p3, p4): { x, y, t, u } | false
```

Same, but only when the crossing lies on both segments (`t` and `u` in [0, 1]).

### closestPointOnSegment

```ts
closestPointOnSegment(p: Point, a: Point, b: Point): { t, point, distance }
```

Closest point to `p` on `a`–`b`, 2D or 3D. A zero-length segment returns `a`.

### closestSegmentPoints

```ts
closestSegmentPoints(p1: Point, q1: Point, p2: Point, q2: Point): { s, t, a, b, distance }
```

Closest points between two segments (Ericson 5.1.9), 2D or 3D. `s`, `t` in [0, 1] along each, `a`, `b` the points, `distance` 0 when they cross. Handles parallel and zero-length segments.

### rayPlane

```ts
rayPlane(origin: Point, direction: Point, plane: Plane): { t, point } | false
```

`false` when the ray is parallel (off the plane) or the plane is behind it. A ray lying in the plane hits at `t = 0`.

## Types

```ts
type Point = { x: number; y: number; z?: number }                        // Vector2 / Vector3 fit
type Plane = { normal: Point; d: number } | { normal: Point; point: Point } // normal need not be unit
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

- [`@papit/triangle-intersection`](https://www.npmjs.com/package/@papit/triangle-intersection): ray vs triangle
- [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk): capsules against any convex shape
