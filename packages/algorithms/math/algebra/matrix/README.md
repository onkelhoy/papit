# @papit/matrix

A high‑performance column‑major matrix math library for games, WebGL, and real‑time simulations.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

It provides **general M×N matrices** plus optimized **3×3 and 4×4 transformation matrices**, with a clean, chainable API designed for **graphics pipelines**, **linear algebra**, and **engine‑level math**.

The library is intentionally low‑level, allocation‑aware, and predictable — suitable for hot paths in render loops.

---

![Type](https://img.shields.io/badge/Type-math:algebra-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/matrix.svg?logo=npm)](https://www.npmjs.com/package/@papit/matrix)

---

## Features

* ✅ **Column‑major storage** (WebGL / OpenGL friendly)
* ✅ General **M×N matrices** via `Matrix`
* ✅ Specialized `Matrix3` `Matrix4` and `MatrixN`
* ✅ Chainable **mutating instance API**
* ✅ Functional **static helpers** (immutable style)
* ✅ Built‑in support for **TRS transforms**
* ✅ Perspective, orthographic & frustum projections
* ✅ Right‑handed & left‑handed coordinate systems
* ✅ Zero external dependencies (except `@papit/game-vector`)

---

## Installation

```bash
npm install @papit/matrix
```

---

## Quick Start

```ts
import { Matrix4 } from "@papit/matrix";

const m = new Matrix4();

m.translate(0, 0, -5)
 .rotateY(Math.PI / 4)
 .scale(1, 2, 1);
```

All instance methods **mutate** the matrix and return `this` for chaining.

---

## Matrix Types

### `Matrix`

General‑purpose **M×N matrix** backed by `Float32Array`.

```ts
const m = new Matrix(2, 3);   // 2 rows, 3 columns
m.add(1).multiply(2);
```

Useful for:

* Arbitrary linear algebra
* Data transforms
* Non‑graphics use cases

---

### `Matrix3`

Optimized **3×3 matrix**, commonly used for:

* 2D transforms
* Normal matrices
* Rotation + scale (no translation)

```ts
const m = new Matrix3();
m.rotate(Math.PI / 2);
```

---

### `Matrix4`

Optimized **4×4 homogeneous transform matrix** for 3D graphics.

Supports:

* Translation
* Rotation (X/Y/Z & arbitrary axis)
* Scaling
* Projection
* Camera transforms

```ts
const view = new Matrix4()
  .lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
```

---

## Transform Operations

### Translation

```ts
m.translate(x, y, z);
```

### Rotation

```ts
m.rotateX(angle);
m.rotateY(angle);
m.rotateZ(angle);
```

Or generic N‑dimensional rotation:

```ts
m.rotate(angle, [0, 1]); // rotate plane (axis indices)
```

### Scale

```ts
m.scale(1, 2, 1);
```

---

## Projection

### Perspective

```ts
m.perspective(fovY, aspect, near, far);
```

### Orthographic

```ts
m.orthographic(left, right, bottom, top, near, far);
```

### Frustum

```ts
m.frustum(left, right, bottom, top, near, far);
```

---

## Inversion

Optimized **TRS inverse** (translation, rotation, scale):

```ts
m.inverse();           // defaults to TRS
m.inverse("TRS");
```

Gaussian elimination is planned but not yet implemented.

---

## Mutating vs Functional Style

### Mutating (fast, no allocations)

```ts
m.translate(1, 0, 0).rotateY(a);
```

### Functional (immutable)

```ts
const m2 = Matrix4.rotateY(m, a);
```

Static helpers clone automatically.

---

## Storage Layout

All matrices are **column‑major**:

```
index = column * rows + row
```

This matches:

* WebGL uniforms
* GLSL expectations
* OpenGL conventions

Row‑major input (nested arrays) is automatically transposed on creation.

---

## Design Philosophy

* ⚡ Performance first
* 🧠 Explicit math (no hidden magic)
* 🔁 Predictable mutation
* 🎮 Game‑engine friendly

This library is intended as a **math primitive**, not a scene graph or engine.

---

## Related Packages

* [`@papit/vector`](https://www.npmjs.com/package/@papit/vector) — Vector math used internally

---

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
