# @papit/box-intersection

A lightweight, type‑safe library for 2D box (AABB) intersection and point‑in‑rectangle tests. Part of the [Papit](https://github.com/onkelhoy/papit) ecosystem.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/box-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/box-intersection)

---

## Features

- **AABB collision detection** – computes the overlapping rectangle between two axis‑aligned bounding boxes, or returns `false` if they don't intersect.
- **Point‑in‑rectangle test** – fast and accurate.
- **Flexible rectangle definitions** – works with properties `w`/`h` or `width`/`height` interchangeably.
- **Tiny size** – zero dependencies (except `@papit/vector` for the point type, but plain objects are also accepted).
- **Fully typed** – written in TypeScript with precise types.

---

## Installation

```bash
npm install @papit/box-intersection
```

---

## Usage

### Basic Example

```typescript
import { AABB, isPointInRectangle } from '@papit/box-intersection';

// Rectangles with 'w' and 'h'
const rectA = { x: 0, y: 0, w: 10, h: 10 };
const rectB = { x: 5, y: 5, w: 10, h: 10 };

const overlap = AABB(rectA, rectB);
if (overlap) {
  console.log(`Overlap at (${overlap.x}, ${overlap.y}) with size ${overlap.w}×${overlap.h}`);
} else {
  console.log('No overlap');
}
// Output: Overlap at (5, 5) with size 5×5

// Point test
const point = { x: 7, y: 7 };
console.log(isPointInRectangle(point, rectA)); // true
```

### With `width`/`height` Properties

```typescript
const rect = { x: 10, y: 20, width: 30, height: 40 };
const point = { x: 25, y: 30 };
console.log(isPointInRectangle(point, rect)); // true
```

### Using `@papit/vector` (optional)

```typescript
import { Vector2 } from '@papit/vector';
const p = new Vector2(5, 5);
const rect = { x: 0, y: 0, w: 10, h: 10 };
console.log(isPointInRectangle(p, rect)); // true
```

---

## API Reference

### `AABB(a: Rectangle, b: Rectangle): Rectangle | false`

Computes the intersection rectangle between two AABBs.

- **Parameters**: two objects satisfying the `Rectangle` type.
- **Returns**: an object `{ x, y, w, h }` describing the overlapping area, or `false` if the boxes do not intersect.

**Note**: The returned rectangle always uses `w` and `h` keys, regardless of the input’s key names.

---

### `isPointInRectangle(point: Vector2 | { x: number, y: number }, rect: Rectangle): boolean`

Determines whether a point lies inside (or on the border of) a rectangle.

- **Parameters**:
  - `point` – an object with `x` and `y` properties (or a `Vector2` instance).
  - `rect` – a `Rectangle` object.
- **Returns**: `true` if the point is within or on the edge of the rectangle, `false` otherwise.

---

### `dim(rectangle: Rectangle, dim: 'w' | 'h'): number`

Utility to safely extract the width or height from a rectangle, regardless of whether the property is named `w`/`width` or `h`/`height`.

- **Parameters**:
  - `rectangle` – a `Rectangle` object.
  - `dim` – `'w'` or `'h'`.
- **Returns**: the numeric value of the requested dimension.

---

### `type Rectangle`

A flexible type that accepts either `{ x, y, w, h }` or `{ x, y, width, height }`. The library normalises both forms internally.

```typescript
type Rectangle = {
  x: number;
  y: number;
  w: number; 
  h: number;
} | {
  x: number;
  y: number;
  width: number; 
  height: number;
};
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

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit) or open an issue in the [issue tracker](https://github.com/onkelhoy/papit/issues).
