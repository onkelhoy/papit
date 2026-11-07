# @papit/sat

Separating Axis Theorem collision for polygons, returning the contact normal and overlap. Reach for it to detect and resolve collisions, concave polygons included when they are split into convex pieces.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-math:intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/sat.svg?logo=npm)](https://www.npmjs.com/package/@papit/sat)

---

## Installation

```bash
npm install @papit/sat
```

## Usage

```typescript
import { SAT } from "@papit/sat";
import { Polygon } from "@papit/polygon";

const a = new Polygon({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 });
const b = new Polygon({ x: 8, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 10 }, { x: 8, y: 10 });

const contact = SAT(a, b); // { normal: Vector2 (1, 0), overlap: 2 }

if (contact)
{
  a.move(-contact.normal.x * contact.overlap, -contact.normal.y * contact.overlap);
}
```

A plain convex shape works too:

```typescript
SAT({ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }, other);
```

`npm run view` opens a demo: click to place vertices, click the first one to close, then drag polygons into each other.

## API

### SAT

```typescript
SAT(polygonA: Polygon, polygonB: Polygon): { normal: Vector2, overlap: number } | false
```

Returns `false` when the polygons don't touch. Otherwise `normal` is a unit vector pointing from A towards B, and `overlap` is how far they intersect along it.

### Polygon

`vertices` is all that's required. A concave polygon needs its convex pieces, and the first of these found is used:

| Field or method        | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `getShape(index)`      | One convex piece, as vertices or `{ vertices }`                |
| `shapes`               | The pieces, as shapes, vertex groups or index lists            |
| `getTriangle(index)`   | One triangle                                                   |
| `triangles`            | Flat vertex indices, three per triangle                        |

`@papit/polygon` provides these for you.

## Design notes

- **2D only:** for 3D, rotated boxes or curved shapes use [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk).
- **Broad phase first:** bounding boxes are compared before any axis is tested.
- **Convex pieces:** each piece of A is tested against each piece of B, so the cost grows with pieces A × B × edges.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/polygon`](https://www.npmjs.com/package/@papit/polygon): the polygon to pass in
- [`@papit/box-intersection`](https://www.npmjs.com/package/@papit/box-intersection): the bounding box check
- [`@papit/gjk`](https://www.npmjs.com/package/@papit/gjk): convex collision in 2D and 3D
- [`@papit/triangulation`](https://www.npmjs.com/package/@papit/triangulation): splits a polygon into convex pieces
