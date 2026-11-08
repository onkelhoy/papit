# @papit/irregular-grid

Seeded organic all-quad grids: a hexagon of triangles merged into quads, subdivided and relaxed, with full adjacency and tileable chunks. Reach for it for Townscaper-style towns, terrain or maps.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/irregular-grid.svg?logo=npm)](https://www.npmjs.com/package/@papit/irregular-grid)

---

# Installation

```bash
npm install @papit/irregular-grid
```

# Usage

```typescript
import { IrregularGrid } from "@papit/irregular-grid";

const grid = IrregularGrid.hex({ radius: 6, seed: "town" });

for (let c = 0; c < grid.cellCount; c++)
{
    const [a, b, c2, d] = grid.cornersOf(c); // vertex indices, counter-clockwise
    const neighbours = grid.neighboursOf(c); // -1 on the boundary
}
```

Larger worlds tile hexagon chunks. Any chunk builds alone, in any order, and seams line up:

```typescript
import { GridWorld } from "@papit/irregular-grid";

const world = new GridWorld({ radius: 5, seed: "map" });
const chunk = world.chunk(1, -2);
```

Run `npm run view` for a 2D preview with seed, relax and chunk controls.

# API

## IrregularGrid.hex

```typescript
IrregularGrid.hex(options: HexGridOptions): IrregularGrid
```

A hexagon of triangles, random pairs merged into quads, everything subdivided into quads, then relaxed.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `radius` | `number` | | Hexagon radius in triangle edges, at least 1 |
| `seed` | `number \| string` | `0` | Same seed, same grid |
| `relax` | `number` | `50` | Relax iterations |
| `strength` | `number` | `0.3` | Move per iteration, 0..1 |
| `size` | `number` | `1` | Triangle edge length, cells end up about half that |
| `merge` | `number` | `1` | Chance a triangle pair becomes a quad |
| `center` | `[q, r]` | `[0, 0]` | Lattice offset, used by chunks |

## IrregularGrid

Flat typed arrays, ready for loops and GPU buffers. Edge `i` of a cell runs from corner `i` to `i + 1`.

| Member | Description |
| --- | --- |
| `positions` | `Float64Array`, x, y per vertex |
| `cells` | `Uint32Array`, 4 vertices per cell, counter-clockwise |
| `edges`, `edgeCells` | 2 vertices per edge, 2 cells per edge (-1 on the boundary) |
| `cellEdges`, `cellNeighbours` | 4 per cell, edge and neighbour across cell edge `i` |
| `boundary` | `Uint8Array`, 1 for fixed boundary vertices |
| `vertexCount`, `cellCount`, `edgeCount` | Counts |
| `cornersOf(c)`, `neighboursOf(c)` | Views into `cells` / `cellNeighbours` |
| `cellsOfVertex(v)`, `neighboursOfVertex(v)` | Adjacent cells and vertices |
| `vertex(v)`, `center(c)` | `Vector2` |
| `area(c)` | Signed area, positive for counter-clockwise |
| `contains(c, x, y)`, `cellAt(x, y)` | Point lookup, `cellAt` returns -1 outside |
| `relax(iterations?, strength?)` | Pulls cells toward squares of the average size |

`new IrregularGrid(positions, cells)` builds adjacency for any quad mesh.

## GridWorld

```typescript
new GridWorld(options: Omit<HexGridOptions, "center">)
```

| Member | Description |
| --- | --- |
| `chunk(i, j)` | Chunk grid in world space, cached |
| `unload(i, j)` | Drops a cached chunk |
| `GridWorld.chunkCenter(i, j, radius)` | Lattice centre, chunks step by (2R, -R) and (R, R) |

# Design notes

- Build is O(n) in cells, `relax` is O(n) per iteration, `cellAt` is O(n).
- Deterministic: randomness only from `@papit/random`, relax has no randomness and a fixed order.
- Boundary vertices never move, so chunk seams match exactly. Seams stay straight lines, like in Townscaper.
- Relax pulls toward squares of the mean cell area, so corners move toward 90 degrees and sizes even out.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/random](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/random)
- [@papit/vector](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/math/algebra/vector)
