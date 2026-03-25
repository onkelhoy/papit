# @papit/vector

A high‑performance vector math library for games, graphics, physics, and real‑time simulations.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

It provides **arbitrary‑dimension vectors** plus specialized **Vector2 and Vector3** classes, with a clean, chainable API suitable for **graphics pipelines**, **linear algebra**, and **engine‑level computations**.

The library is intentionally **low‑level, allocation‑aware, and predictable** — ideal for hot paths in physics loops or rendering.

---

![Type](https://img.shields.io/badge/Type-math:algebra-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/vector.svg?logo=npm)](https://www.npmjs.com/package/@papit/vector)

---

## Features

- ✅ **Float32Array-backed vectors** for speed
- ✅ General **N‑dimensional vectors** via `Vector`
- ✅ Specialized **Vector2** and **Vector3** classes
- ✅ Chainable **mutating instance API**
- ✅ Functional **static helpers** (immutable style)
- ✅ Common vector operations: `dot`, `cross`, `distance`, `normalize`
- ✅ Vector rotation (`rotateX/Y/Z`) for 3D
- ✅ Perpendicular and angle helpers for 2D
- ✅ Zero dependencies

---

## Installation

```bash
npm install @papit/vector
```

---

## Quick Start

```ts
import { Vector3 } from "@papit/vector";

const v = new Vector3(1, 2, 3);

v.add([1, 0, -1]).normalize().multiply(5);

console.log(v.magnitude); // 5
```

All instance methods **mutate** the vector and return `this` for chaining.

---

## Vector Types

### `Vector`

General-purpose **N-dimensional vector**:

```ts
const v = new Vector(4); // 4D vector
v.add([1, 2, 3, 4]);
```

Useful for:

- Arbitrary linear algebra
- Physics simulations
- Data transformations

---

### `Vector2`

Specialized **2D vector**:

```ts
const v = new Vector2(3, 4);
console.log(v.angle); // angle in radians
v.angle = Math.PI / 2; // rotate vector
```

Includes:

- 2D rotation helpers
- Perpendicular computation
- Angle calculation

---

### `Vector3`

Specialized **3D vector**:

```ts
const v = new Vector3(1, 0, 0);
v.rotateY(Math.PI / 2).cross([0, 1, 0]);
```

Includes:

- 3D rotations (`rotateX`, `rotateY`, `rotateZ`)
- Cross product
- Vector arithmetic

---

## Vector Operations

### Arithmetic

```ts
v.add([1, 2, 3]);
v.subtract([0, 1, 0]);
v.multiply(2);
v.divide([2, 2, 2]);
```

### Normalization & Magnitude

```ts
v.normalize(); // unit vector
v.magnitude; // length
v.magnitude = 10; // scale to new length
```

### Dot & Cross Products

```ts
Vector3.dot(a, b);
Vector3.cross(a, b);
Vector2.cross(a, b); // scalar in 2D
```

### Distance

```ts
Vector.distance(a, b);
```

---

## Mutating vs Functional Style

### Mutating (fast, no allocations)

```ts
v.add([1, 0, 0]).rotateY(Math.PI / 4);
```

### Functional (immutable)

```ts
const v2 = Vector3.add(a, b);
```

Static helpers automatically clone vectors.

---

## Design Philosophy

- ⚡ **Performance first**
- 🧠 Explicit math (no hidden magic)
- 🔁 Predictable mutation
- 🎮 **Game-engine friendly**

This library is a **math primitive**, not a scene graph or engine.

---

## Related Packages

- [`@papit/game-matrix`](https://www.npmjs.com/package/@papit/game-matrix) — Matrix math for transformations and graphics pipelines

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
