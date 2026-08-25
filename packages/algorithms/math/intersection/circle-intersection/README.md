# @papit/circle-intersection

A simple, type‑safe library for circle intersection and point‑in‑circle tests in 2D.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-intersection-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/circle-intersection.svg?logo=npm)](https://www.npmjs.com/package/@papit/circle-intersection)

---

## Features

- **Circle‑circle intersection** – finds the intersection points of two circles.
- **Point‑in‑circle test** – checks whether a point lies inside or on a circle.
- **Flexible circle definition** – works with both `{ x, y, r }` and `{ x, y, radius }` objects.
- **Returns detailed intersection data** – including the intersection points, the chord midpoint, and geometric parameters.
- **Zero dependencies** – only uses `@papit/vector` for vector math (but you can pass plain objects).
- **Fully typed** – written in TypeScript.

---

## Installation

```bash
npm install @papit/circle-intersection
```

---

## Usage

### Basic Example

```typescript
import {
  CircleIntersection,
  isPointInCircle,
} from "@papit/circle-intersection";

// Define two circles
const circleA = { x: 0, y: 0, r: 5 };
const circleB = { x: 6, y: 0, r: 5 };

const result = CircleIntersection(circleA, circleB);
if (result) {
  console.log(
    `Intersection points: (${result.va.x}, ${result.va.y}) and (${result.vb.x}, ${result.vb.y})`
  );
  console.log(`Chord midpoint: (${result.vc.x}, ${result.vc.y})`);
  console.log(`Half chord length: ${result.h}`);
} else {
  console.log("Circles do not overlap.");
}
// Output: Intersection points: (3,4) and (3,-4)
// etc.

// Point‑in‑circle
const point = { x: 3, y: 4 };
console.log(isPointInCircle(point, circleA)); // true
```

### Using `radius` Instead of `r`

```typescript
const circleC = { x: 0, y: 0, radius: 5 };
const circleD = { x: 6, y: 0, radius: 5 };
const result2 = CircleIntersection(circleC, circleD); // same result
```

### Using `@papit/vector` Instances

```typescript
import { Vector2 } from "@papit/vector";

const center1 = new Vector2(0, 0);
const center2 = new Vector2(6, 0);
// The function expects plain objects or VectorValue; you can pass Vector2 as they have x/y.
const result3 = CircleIntersection(
  { x: center1.x, y: center1.y, r: 5 },
  { x: center2.x, y: center2.y, r: 5 }
);
// or directly use the vector's x/y properties.
```

---

## API Reference

### `CircleIntersection(a: Circle, b: Circle): false | IntersectionResult`

Computes the intersection points of two circles, via the radical-line method: the line through both intersection points crosses the line connecting the two centres at a single point, a known distance from circle `a`'s centre; stepping perpendicular from there lands on the two intersection points.

- **Parameters**: Two `Circle` objects (must have `x`, `y`, and either `r` or `radius`).
- **Returns**:
  - `false` if the circles are disjoint, concentric, or one fully contains the other without touching.
  - An object containing:
    - `va`, `vb` – the two intersection points as `{ x, y }` objects. Equal to each other when the circles are tangent.
    - `vc` – the midpoint of the chord `va`–`vb`, where it crosses the centre-to-centre line.
    - `a` – distance from circle `a`'s centre to `vc`, along the centre-to-centre line.
    - `h` – half the chord length, i.e. the distance from `vc` to `va` (or `vb`).

**Note**: Earlier versions returned an object with `NaN` coordinates when one circle fully contained the other. That case now returns `false` like any other non-intersecting pair — check the return value with a simple truthiness/`false` check rather than inspecting `h` for `NaN`.

---

### `isPointInCircle(p: VectorValue, circle: Circle): boolean`

Determines whether a point lies inside or on the circumference of a circle.

- **Parameters**:
  - `p` – the point to test (object with `x` and `y`).
  - `circle` – a `Circle` object.
- **Returns**: `true` if the point is inside or on the circle, `false` otherwise.

---

### Type `Circle`

```typescript
type Circle =
  | {
      x: number;
      y: number;
      r: number;
    }
  | {
      x: number;
      y: number;
      radius: number;
    };
```

The library normalises the radius internally. A `Circle` with neither `r` nor `radius` set will throw.

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
