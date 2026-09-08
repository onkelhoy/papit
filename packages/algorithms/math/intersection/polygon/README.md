# @papit/polygon-intersection

A lightweight point‑in‑polygon detection library using ray casting (with a deprecated triangulation fallback).

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/polygon-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/polygon-intersection)

---

## Installation

```bash
npm install @papit/polygon-intersection
```

## Usage

```typescript
import {
  isPointInPolygonRayCasting,
  isPointInPolygonTriangles, // deprecated
} from "@papit/polygon-intersection";
```

### `isPointInPolygonRayCasting(point, polygon)`

- **point**: `{ x: number, y: number }` – the point to test.
- **polygon**: `{ vertices: VectorValue[] }` – an array of vertices in order (clockwise or counter‑clockwise).
- **Returns**: `boolean` – `true` if the point is inside the polygon, `false` otherwise.

Uses the **even‑odd rule** (ray casting) – a horizontal ray is cast to the right; if it crosses the polygon edges an odd number of times, the point is inside.

### `isPointInPolygonTriangles(point, polygon)` (deprecated)

- **point**: as above.
- **polygon**: `{ vertices: VectorValue[], triangles?: number[] }` – requires pre‑computed triangle indices (flat array of vertex indices, groups of 3).
- **Returns**: `false` if no triangles, otherwise `[true, [a, b, c]]` if inside any triangle, or `false`.

> ⚠️ **Deprecated** – use the `@papit/sat` package instead for a more robust SAT‑based implementation.

---

## Examples

### Basic usage

```typescript
import { isPointInPolygonRayCasting } from "@papit/polygon-intersection";

const square = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

console.log(isPointInPolygonRayCasting({ x: 5, y: 5 }, square)); // true
console.log(isPointInPolygonRayCasting({ x: 15, y: 5 }, square)); // false
```

### With a concave polygon

```typescript
const concave = {
  vertices: [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

console.log(isPointInPolygonRayCasting({ x: 5, y: 2 }, concave)); // true (in the notch)
console.log(isPointInPolygonRayCasting({ x: 2, y: 8 }, concave)); // true
```

---

## API

| Function                     | Parameters                               | Returns                                                      | Description                           |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `isPointInPolygonRayCasting` | `(point: VectorValue, polygon: Polygon)` | `boolean`                                                    | Ray‑casting test (recommended)        |
| `isPointInPolygonTriangles`  | `(point: VectorValue, polygon: Polygon)` | `boolean \| [true, [VectorValue, VectorValue, VectorValue]]` | **Deprecated** – triangulation method |

---

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
