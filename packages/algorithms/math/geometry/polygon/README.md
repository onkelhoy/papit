# @papit/polygon

A simple mathematical polygon class for games and geometry applications – with built‑in triangulation, convex decomposition, and lazy translation via offset.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-geometry-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/polygon.svg?logo=npm)](https://www.npmjs.com/package/@papit/polygon)

---

## Installation

```bash
npm install @papit/polygon
```

## Usage

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
poly.vertices; // [Vector2, Vector2, Vector2, Vector2] (world-space)

// Access individual pieces (convex decomposition results)
const shape = poly.getShape(0); // returns a PolygonShape instance
shape.vertices; // array of Vector2 (shared with parent)

// Get a specific triangle in world-space
const [a, b, c] = poly.getTriangle(0); // each is a Vector2

// Translate without re‑triangulating (efficient for moving objects)
poly.move(10, 0); // add (10,0) to the offset
poly.set(0, 0); // set absolute offset to (0,0)
```

### Replacing vertices

Assigning a new `vertices` array re‑runs the full pipeline (calibration, triangulation, convex decomposition) automatically:

```typescript
poly.vertices = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 2, y: 2 },
  { x: 0, y: 4 },
];
// polygon is now re‑calibrated, re‑triangulated, and shapes are regenerated
```

## API

### `new Polygon(...vertices: VectorValue[])`

Creates a new polygon with the given vertices. The vertices are normalised (removing collinear points, ensuring CCW winding) and triangulated automatically. The class uses a lazy offset system: `move()` and `set()` update only an offset, not the actual vertex objects, until `vertices` is accessed.

### Properties

| Property    | Type                                             | Description                                                               |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `vertices`  | `Vector2[]`                                      | World‑space vertices (read/write). Assigning triggers full recalculation. |
| `triangles` | `number[]`                                       | Flat triangle index array (3 indices per triangle).                       |
| `concave`   | `boolean`                                        | `true` if the polygon is concave after calibration.                       |
| `center`    | `Vector2`                                        | Centroid of the polygon (world‑space).                                    |
| `boundary`  | `{ x: number; y: number; w: number; h: number }` | Axis‑aligned bounding box (world‑space).                                  |

### Methods

| Method                                                    | Description                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `move(dx: number, dy: number)`                            | Translates the polygon by the given offset (additive).                 |
| `move(vector: VectorValue)`                               | Translates by the vector.                                              |
| `set(x: number, y: number)`                               | Sets the absolute offset to the given coordinates.                     |
| `set(vector: VectorValue)`                                | Sets absolute offset from a vector.                                    |
| `getTriangle(index: number): [Vector2, Vector2, Vector2]` | Returns the triangle vertices in world‑space.                          |
| `getShape(index: number): PolygonShape \| undefined`      | Returns a convex piece as a `PolygonShape` instance.                   |
| `triangulate()`                                           | Re‑runs triangulation and decomposition manually (usually not needed). |

### The `PolygonShape` class

A lightweight wrapper returned by `getShape()`. It shares the same `Vector2` objects as its parent polygon, so when the parent moves, the child’s vertices reflect the updated position automatically (as long as you read `vertices` after the move).

- `vertices: Vector2[]` – world‑space vertices of the convex piece.
- `boundary` – bounding box (relative to its own offset).
- `center` – centroid of the piece.
- `getTriangle(index)` – if the piece is further triangulated (it is not by default), you can access triangles.

> **Note:** The parent polygon’s `getShape` pieces are **not** automatically re‑triangulated when you move the parent – only the shared vertex objects are updated lazily via the `_dirty` flag. To get fresh shapes after a transformation, simply access `poly.vertices` first to force the update.

## How it works

1. **Calibration** – strips collinear vertices, ensures counter‑clockwise winding.
2. **Ear‑clipping triangulation** – produces a flat triangle index list (`triangles`).
3. **Hertel–Mehlhorn convex decomposition** – merges adjacent triangles into convex pieces, stored internally as `PolygonShape` instances.

The polygon stores an `_offset` (Vector2) and a `_dirty` flag. Calling `move()` or `set()` only changes the offset and marks the polygon as dirty. The actual `Vector2` objects are updated **lazily** when `vertices` is accessed – making it cheap to move the polygon every frame without recomputing triangulation.

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 – Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
