# @papit/line-intersection

A simple, type‑safe library for line and segment intersection tests in 2D.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/line-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/line-intersection)

---

## Features

- **Line intersection** – finds the intersection point of two infinite lines.
- **Segment intersection** – restricts the intersection to finite line segments.
- **Works with any `VectorValue`** – accepts plain objects `{x,y}`, arrays, or `Vector2` instances from `@papit/vector`.
- **Returns intersection coordinates and parametric values (t, u)** – useful for further calculations.
- **Zero dependencies** – only uses `@papit/vector` for vector math (but you can pass plain objects).

---

## Installation

```bash
npm install @papit/line-intersection
```

---

## Usage

### Basic Example

```typescript
import {
  LineIntersection,
  SegmentIntersection,
} from "@papit/line-intersection";

// Define two lines using plain objects
const p1 = { x: 0, y: 0 };
const p2 = { x: 10, y: 0 };
const p3 = { x: 5, y: -5 };
const p4 = { x: 5, y: 5 };

// Intersection of infinite lines
const lineResult = LineIntersection(p1, p2, p3, p4);
if (lineResult) {
  console.log(`Lines intersect at (${lineResult.x}, ${lineResult.y})`);
  console.log(`t = ${lineResult.t}, u = ${lineResult.u}`);
}
// Output: Lines intersect at (5, 0), t = 0.5, u = 0.5

// Intersection of finite segments
const segResult = SegmentIntersection(p1, p2, p3, p4);
if (segResult) {
  console.log(`Segments intersect at (${segResult.x}, ${segResult.y})`);
} else {
  console.log("Segments do not intersect.");
}
// Output: Segments intersect at (5, 0)
```

### Using `@papit/vector` Instances

```typescript
import { Vector2 } from "@papit/vector";

const v1 = new Vector2(0, 0);
const v2 = new Vector2(10, 0);
const v3 = new Vector2(5, -5);
const v4 = new Vector2(5, 5);

const result = SegmentIntersection(v1, v2, v3, v4);
// Works the same way
```

---

## API Reference

### `LineIntersection(p1, p2, p3, p4): false | { x: number, y: number, t: number, u: number }`

Computes the intersection point of two infinite lines defined by points `p1→p2` and `p3→p4`.

- **Parameters**: Four `VectorValue` objects (each with `x` and `y`).
- **Returns**:
  - An object with `x`, `y` (coordinates of the intersection), and `t`, `u` (parametric values along the first and second line respectively).
  - `false` if the lines are parallel or coincident (denominator = 0).

---

### `SegmentIntersection(p1, p2, p3, p4): false | { x: number, y: number, t: number, u: number }`

Determines if two **finite line segments** intersect. Internally calls `LineIntersection` and checks whether `0 ≤ t ≤ 1` and `0 ≤ u ≤ 1`.

- **Parameters**: Four `VectorValue` objects defining the segment endpoints.
- **Returns**: The same intersection object as `LineIntersection` if the intersection lies within both segments, otherwise `false`.

---

### Type `VectorValue`

Imported from `@papit/vector`. Any object with numeric `x` and `y` properties, e.g.:

```typescript
type VectorValue = { x: number; y: number } | Vector2 | [number, number];
```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and clone it locally.
2. Install dependencies: `npm install`
3. Make your changes and add tests (we use `node:test`).
4. Run tests: `npm test`
5. Ensure the code is properly formatted and linted.
6. Submit a pull request with a clear description of your changes.

---

## License

Licensed under the @Papit License 1.0 – Copyright (c) 2024 Henry Pap (@onkelhoy).

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit) or open an issue in the [issue tracker](https://github.com/onkelhoy/papit/issues).
