# @papit/triangulation

Triangulate a 2D polygon using the ear-clipping algorithm, with optional Hertel–Mehlhorn convex decomposition. This package cleans up your polygon by removing collinear vertices, detects concavity, and computes a triangle mesh ready for rendering or physics.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/triangulation.svg?logo=npm)](https://www.npmjs.com/package/@papit/triangulation)

---

## Features

- Removes collinear vertices to produce a clean polygon.
- Detects polygon orientation and concavity.
- Ear‑clipping triangulation for simple polygons (convex or concave).
- Optional Hertel–Mehlhorn convex decomposition (when `Decomposition` is implemented).
- Returns triangle indices ready for use with WebGL or other graphics APIs.

## Installation

```bash
npm install @papit/triangulation
```

## Usage

```typescript
import { Triangulate, type Polygon } from "@papit/triangulation";

// Define a polygon – vertices are [x, y] pairs
const polygon: Polygon = {
  vertices: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  triangles: [], // placeholder, will be filled
};

const result = Triangulate(polygon);
if (result[0] === false) {
  // Success: polygon.triangles now holds triangle indices
  console.log(polygon.triangles); // [0,1,2, 0,2,3]
} else {
  console.error(`Error (${result[0]}): ${result[1]}`);
}
```

## API

### `Polygon` type

```typescript
type Polygon = {
  vertices: VectorValue[]; // array of [x, y] or Vector2
  triangles?: number[]; // flat triangle indices (output)
  convex?: number[] | number[][]; // optional convex decomposition
  concave?: boolean; // (output) true if concave
  centeroffset?: Vector2; // (output) offset from first vertex
  boundaryindex?: number[]; // (output) indices of min/max vertices
  calibrated?: boolean; // (output) true after calibration
  changed?: boolean; // (output) true if modified
};
```

> At least one of `triangles` or `convex` **must** be provided (even as empty array) to satisfy the type.

### `Calibrate(polygon: Polygon, verbose?: boolean): void`

Cleans the polygon in‑place:

- Removes collinear vertices.
- Computes bounding box indices.
- Detects concavity and reverses winding if needed.
- Computes a center offset relative to the first vertex.

### `Triangulation(polygon: Polygon): [error: false] | [error: true, message: string]`

Runs the ear‑clipping algorithm and fills `polygon.triangles` with flat triangle indices.

### `Triangulate(polygon: Polygon): [error: false] | [error: "triangulation" | "decomposition", message: string]`

A convenience wrapper that calls `Calibrate` and `Triangulation`, and then `Decomposition` (if available). Returns a tuple indicating success or the stage that failed.

## Example

Triangulating a concave L‑shape:

```typescript
const Lshape: Polygon = {
  vertices: [
    [0, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [1, 2],
    [0, 2],
  ],
  triangles: [],
};

Triangulate(Lshape);
console.log(Lshape.triangles); // e.g. [0,1,2, 0,2,5, 2,3,4, 2,4,5] (order may vary)
```

## Dependencies

- `@papit/vector` – provides `Vector2` and `VectorValue` types.
- `@papit/triangle-intersection` – used for point‑in‑triangle tests during ear clipping.

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

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
