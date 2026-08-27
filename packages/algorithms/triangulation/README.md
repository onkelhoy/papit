# @papit/triangulation

Triangulate a 2D polygon using the ear‑clipping algorithm, with optional Hertel–Mehlhorn convex decomposition.  
This package cleans up your polygon by removing collinear vertices, detects concavity, and computes a triangle mesh ready for rendering or physics.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/triangulation.svg?logo=npm)](https://www.npmjs.com/package/@papit/triangulation)

---

## Features

- Ear‑clipping triangulation for simple polygons (convex or concave).
- Optional Hertel–Mehlhorn convex decomposition (`Decomposition`) – merges triangles into convex pieces.
- Pure functions: no mutation of the input polygon (except reading `vertices` and `triangles`).
- Returns triangle or shape indices ready for WebGL, physics, or further processing.

## Installation

```bash
npm install @papit/triangulation
```

## Usage

### Triangulation

```typescript
import { Triangulation, type Polygon } from "@papit/triangulation";

// Define a polygon – vertices are objects with x,y (or Vector2)
const polygon: Polygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ],
  triangles: [], // placeholder, will be filled after triangulation
};

const result = Triangulation(polygon);
if (result.error === false) {
  // Success: result.triangles holds flat triangle indices
  console.log(result.triangles); // e.g. [0,1,2, 0,2,3]
  // You can now assign it to polygon.triangles if needed
  polygon.triangles = result.triangles;
} else {
  console.error(`Triangulation error: ${result.error}`);
}
```

### Convex Decomposition

After triangulation, you can decompose the polygon into convex pieces:

```typescript
import { Decomposition } from "@papit/triangulation";

// polygon.triangles must be set (e.g. from Triangulation)
const decompResult = Decomposition(polygon);
if (decompResult.error === false) {
  // decompResult.shapes is a flat array: [size1, i1, i2, …, size2, j1, j2, …]
  console.log(decompResult.shapes);
} else {
  console.error(`Decomposition error: ${decompResult.error}`);
}
```

### Combined Workflow

```typescript
const triResult = Triangulation(polygon);
if (triResult.error === false) {
  polygon.triangles = triResult.triangles;
  const decompResult = Decomposition(polygon);
  if (decompResult.error === false) {
    // Use decompResult.shapes for convex pieces
  }
}
```

## API

### `Polygon` type

```typescript
type Polygon = {
  vertices: VectorValue[]; // array of {x,y} or Vector2 objects
  triangles: number[]; // flat triangle indices (input for Decomposition, output from Triangulation)
};
```

> **Note:** `triangles` must be present (can be an empty array) to satisfy the type, but `Triangulation` does not modify it – it returns the triangles separately.

### `Triangulation(polygon: Polygon): { error: false | string, triangles: number[] }`

Runs the ear‑clipping algorithm and returns:

- `error`: `false` on success, or a descriptive error string.
- `triangles`: a flat array of vertex indices (3 per triangle) if successful.

### `Decomposition(polygon: Polygon): { error: false | string, shapes: number[] }`

Performs Hertel–Mehlhorn convex decomposition on a triangulated polygon.

- Requires `polygon.vertices` and `polygon.triangles` to be valid.
- Returns:
  - `error`: `false` on success, or an error string.
  - `shapes`: a flat array grouped as `[size1, i1, i2, …, size2, j1, j2, …]` where each group is a convex polygon.

### `isConvex(shape: { x: number; y: number }[]): boolean`

Utility to check if a polygon (array of points) is convex.  
Accepts collinear points and is sign‑agnostic (works for both winding directions).

## Example: Concave L‑Shape

```typescript
const Lshape: Polygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
  ],
  triangles: [],
};

const triResult = Triangulation(Lshape);
if (triResult.error === false) {
  Lshape.triangles = triResult.triangles;
  const decompResult = Decomposition(Lshape);
  if (decompResult.error === false) {
    // decompResult.shapes now contains convex pieces
    console.log(decompResult.shapes);
  }
}
```

## Dependencies

- `@papit/vector` – provides `Vector2` and `VectorValue` types.
- `@papit/triangle-intersection` – used for point‑in‑triangle tests during ear clipping.

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
