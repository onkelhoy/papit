# @papit/polygon

a simple mathematical polygon that can be used for games etc

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-geometry-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/polygon.svg?logo=npm)](https://www.npmjs.com/package/@papit/polygon)

---

## installation

```bash
npm install @papit/polygon
```

## usage

```typescript
import { Polygon } from "@papit/polygon";

const poly = new Polygon(
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 }
);

poly.center; // Vector2 { x: 2, y: 2 }
poly.concave; // false
poly.boundary; // { x: 0, y: 0, w: 4, h: 4 }
poly.triangles; // flat index array, e.g. [0, 1, 2, 0, 2, 3]
poly.shapes; // convex pieces after decomposition, as Vector2[][]

poly.move(10, 0); // shift by an offset (additive)
poly.set(0, 0); // set an absolute offset

poly.getVertex(0); // Vector2
poly.getEdge(0); // [Vector2, Vector2]
poly.getTriangle(0); // [Vector2, Vector2, Vector2]
```

Assigning a new `vertices` array re-runs the full pipeline (calibration,
triangulation, and convex decomposition) automatically:

```typescript
poly.vertices = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 2, y: 2 },
  { x: 0, y: 4 },
];
```

## how it works

`Polygon` wraps the `@papit/triangulation` pipeline:

1. **Calibrate** — normalizes winding to counter-clockwise and strips
   collinear vertices.
2. **Triangulation** — ear-clipping, producing a flat triangle index list
   (`polygon.triangles`).
3. **Decomposition** — merges adjacent triangles into convex pieces via
   Hertel–Mehlhorn (`polygon.shapes` / `polygon.shapesindeces`).

The polygon's centroid (`polygon.center`) is computed once per
recalculation, after calibration has run — so it always reflects the
final vertex set (e.g. after collinear points are removed).

`move()`/`set()` apply a lightweight offset without re-triangulating —
useful for moving a polygon around each frame in a game loop without
paying the recalculation cost.

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
