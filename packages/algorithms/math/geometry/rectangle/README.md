# @papit/rectangle

A flexible, lightweight mathematical rectangle class for 2D geometry operations.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-geometry-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/rectangle.svg?logo=npm)](https://www.npmjs.com/package/@papit/rectangle)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@papit/rectangle)](https://bundlephobia.com/package/@papit/rectangle)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Constructor Overloads](#constructor-overloads)
  - [Properties & Getters](#properties--getters)
  - [RectangleObject Type](#rectangleobject-type)
- [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Features

- 🎯 **Multiple Constructor Signatures** – create rectangles in 6 different ways
- 📐 **Flexible Input** – accepts numbers, arrays, objects, and Vector types
- 🔄 **Bounding Box** – compute bounding rectangle from multiple points
- 📦 **Lightweight** – zero dependencies (except `@papit/vector`)
- 🧩 **TypeScript** – fully typed with intelligent overloads
- ✅ **Well Tested** – comprehensive test suite

---

## Installation

```bash
npm install @papit/rectangle
```

---

## Usage

### Constructor Overloads

The `Rectangle` class provides multiple flexible ways to create instances:

#### 1. Square at origin

```typescript
const square = new Rectangle(4);
// { x: 0, y: 0, w: 4, h: 4 }
```

#### 2. Direct (x, y, width, height)

```typescript
const rect = new Rectangle(10, 20, 100, 50);
// { x: 10, y: 20, w: 100, h: 50 }
```

#### 3. Array [x, y, width, height]

```typescript
const rect = new Rectangle([10, 20, 100, 50]);
// { x: 10, y: 20, w: 100, h: 50 }

const square = new Rectangle([0, 0, 5]);
// { x: 0, y: 0, w: 5, h: 5 } (height defaults to width)
```

#### 4. Rectangle Object

```typescript
// Using w/h
const rect1 = new Rectangle({ x: 10, y: 20, w: 100, h: 50 });

// Using width/height
const rect2 = new Rectangle({ x: 10, y: 20, width: 100, height: 50 });
```

#### 5. Two points (opposite corners) – **order matters**

```typescript
const rect = new Rectangle(
  { x: 10, y: 20 }, // top-left corner
  { x: 110, y: 70 } // bottom-right corner
);
// { x: 10, y: 20, w: 100, h: 50 }
```

> **Note:** Unlike the bounding box method, two‑point construction does **not** normalise order. The first point becomes `(x, y)` and the second becomes `(w, h)`. If you need a bounding box that works in any order, use three or more points.

#### 6. Three or more points (bounding box)

```typescript
const rect = new Rectangle(
  { x: 10, y: 20 },
  { x: 110, y: 70 },
  { x: 50, y: 30 }
);
// Computes min/max: { x: 10, y: 20, w: 100, h: 50 }
```

Works with any number of points, in any order.

---

### Properties & Getters

```typescript
const rect = new Rectangle(10, 20, 100, 50);

console.log(rect.x); // 10
console.log(rect.y); // 20
console.log(rect.w); // 100
console.log(rect.h); // 50
console.log(rect.width); // 100 (getter alias for w)
console.log(rect.height); // 50  (getter alias for h)
```

---

### RectangleObject Type

The `RectangleObject` type is used for object‑based construction and supports either `w`/`h` or `width`/`height`:

```typescript
type RectangleObject = {
  x: number;
  y: number;
} & ({ w: number } | { width: number }) &
  ({ h: number } | { height: number });
```

```typescript
// All valid:
const rect1 = new Rectangle({ x: 0, y: 0, w: 100, h: 50 });
const rect2 = new Rectangle({ x: 0, y: 0, width: 100, height: 50 });
const rect3 = new Rectangle({ x: 0, y: 0, w: 100, height: 50 }); // mixed works too
```

---

## Examples

### Creating rectangles

```typescript
import { Rectangle } from "@papit/rectangle";

// Square
const square = new Rectangle(100);

// From coordinates
const rect = new Rectangle(50, 50, 200, 150);

// From array
const arrayRect = new Rectangle([0, 0, 800, 600]);

// From object
const objRect = new Rectangle({ x: 10, y: 20, width: 300, height: 200 });

// From two points (top-left, bottom-right)
const pointRect = new Rectangle({ x: 100, y: 100 }, { x: 500, y: 400 });

// Bounding box from multiple points
const boundingRect = new Rectangle(
  { x: 0, y: 0 },
  { x: 200, y: 100 },
  { x: 150, y: 50 },
  { x: 50, y: 75 }
);
```

### Working with vector library

```typescript
import { Vector2 } from "@papit/vector";
import { Rectangle } from "@papit/rectangle";

const p1 = new Vector2(10, 20);
const p2 = new Vector2(30, 40);

// Works with Vector2 instances directly
const rect = new Rectangle(p1, p2);
// { x: 10, y: 20, w: 30, h: 40 }
```

---

## Development

```bash
# Clone the repository
git clone https://github.com/onkelhoy/papit.git

# Navigate to the rectangle package
cd papit/packages/rectangle

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build
```

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

All contributions must maintain the existing constructor overloads and be fully typed.

---

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
