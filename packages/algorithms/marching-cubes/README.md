# @papit/marching-cubes

Turns a scalar field into a smooth surface: marching squares in 2D and marching cubes in 3D, with cells you can warp. Reach for it for terrain, caves and blobby shapes.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/marching-cubes.svg?logo=npm)](https://www.npmjs.com/package/@papit/marching-cubes)

---

# Installation

```bash
npm install @papit/marching-cubes
```

# Usage

A field is one value per grid point, positive (at least `iso`) is inside.

```typescript
import { marchingCubes, marchingSquares } from "@papit/marching-cubes";

const n = 32;
const values = new Float32Array(n * n * n);
for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    values[x + n * (y + n * z)] = 8 - y + Math.sin(x * .3) * 2; // hilly ground

const { positions, normals } = marchingCubes({ values, width: n, height: n, depth: n });
```

Warp the grid into world space, e.g. scale or bend it into irregular cells:

```typescript
marchingCubes(field, { transform: (x, y, z, out) => { out[0] = x * .5; out[1] = y * .25; out[2] = z * .5; } });
```

Contour lines in 2D:

```typescript
const lines = marchingSquares({ values, width: 64, height: 64 }, { iso: .5 }); // x0, y0, x1, y1 per segment
```

# API

## marchingCubes

```typescript
marchingCubes(field: Field3, options?: FieldOptions): Surface
```

`Field3` is `{ values, width, height, depth }`, index `x + width * (y + height * z)`. `Surface` is `{ positions, normals }`: non-indexed triangles, normals from the field gradient point out of the solid. Fits `@papit/game-mesh` `Mesh` once `bounds` is added.

## marchingSquares

```typescript
marchingSquares(field: Field2, options?: FieldOptions): Float32Array
```

`Field2` is `{ values, width, height }`, index `x + width * y`. Segments keep the inside on their left, so they chain into outlines.

## FieldOptions

| Option | Description |
| --- | --- |
| `iso` | Surface level, default 0 |
| `ambiguity` | `"separate"` (default), `"join"`, or `"decide"` (asymptotic decider per face) for faces with two diagonal inside corners |
| `transform` | `(x, y, z, out)` moves grid points to the world; 3D only |

## triangulate

```typescript
triangulate(bits: number, joinMask: number): number[]
```

The generated case table: edge ids (see `EDGES`, `CORNERS`) in triangles of 3 for 8 corner bits.

# Design notes

- The table is generated, not hand-written: each cube face is cut into segments, segments chain into loops, loops become fans. Neighbouring cubes cut a shared face the same way, so the surface has no cracks in any ambiguity mode.
- Corner order matches `@papit/corner-lookup`: bottom 0..3 at (0,0), (1,0), (1,1), (0,1) in x, z, top 4..7 above.
- O(cells) time; cases are cached, so a field costs one table build per seen case.
- The inside of a cube (not its faces) is not disambiguated, so rare tunnel cases may pick the simpler shape.
- Degenerate input (a side under 2 points, too few values) gives an empty result.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/corner-lookup](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/corner-lookup)
- [@papit/structure](https://github.com/onkelhoy/papit/tree/main/packages/game/structure)
