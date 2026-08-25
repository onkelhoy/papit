# @papit/triangle-intersection

A lightweight, type‑safe library for point‑in‑triangle testing in 2D.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/triangle-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/triangle-intersection)

---

## Features

- **Point‑in‑triangle test** – fast and accurate using the cross‑product method (winding‑based).
- **Supports any `VectorValue`** – plain objects `{x,y}`, arrays, or `Vector2` instances from `@papit/vector`.
- **Zero dependencies** – only uses `@papit/vector` for vector math (but you can pass plain objects).
- **Fully typed** – written in TypeScript.

---

## Installation

```bash
npm install @papit/triangle-intersection
```

---

## Usage

### Basic Example

```typescript
import { isPointInTriangle } from "@papit/triangle-intersection";

// Define a triangle (counter‑clockwise winding)
const v1 = { x: 0, y: 0 };
const v2 = { x: 4, y: 0 };
const v3 = { x: 0, y: 4 };

const point = { x: 1, y: 1 };

if (isPointInTriangle(point, v1, v2, v3)) {
  console.log("Point is inside the triangle");
} else {
  console.log("Point is outside");
}
// Output: Point is inside the triangle
```

### Using `Vector2` Instances

```typescript
import { Vector2 } from "@papit/vector";

const v1 = new Vector2(0, 0);
const v2 = new Vector2(4, 0);
const v3 = new Vector2(0, 4);
const p = new Vector2(1, 1);

console.log(isPointInTriangle(p, v1, v2, v3)); // true
```

---

## Important Note on Winding Order

The implementation assumes that the triangle vertices are given in **counter‑clockwise (CCW)** order. This is the standard convention in many graphics libraries. If your vertices are given in clockwise order, the function will always return `false` (because all cross products will be negative). If you need to support both winding orders, you can either:

- **Normalise** the winding order before calling the function, or
- **Modify** the condition to `>= 0` for one winding and `<= 0` for the other (not provided by default for simplicity).

---

## API Reference

### `isPointInTriangle(p: VectorValue, ...triangle: VectorValue[]): boolean`

Determines whether a point lies inside a triangle (including on its edges).

- **Parameters**:
  - `p` – the point to test (an object with `x` and `y` properties).
  - `...triangle` – the three vertices of the triangle (each a `VectorValue`).
- **Returns**: `true` if the point is inside or on the edge of the triangle, otherwise `false`.
- **Throws**: An error if the number of vertices is not exactly 3.

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
