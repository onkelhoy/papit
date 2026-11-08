# @papit/structure

Builds structures from modules on an irregular grid: corner occupancy picks a module, which is warped into its cell. Reach for it for Townscaper-style towns, farmland or any modular world.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-purple)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/structure.svg?logo=npm)](https://www.npmjs.com/package/@papit/structure)

---

# Installation

```bash
npm install @papit/structure
```

# Usage

```typescript
import { GameEngine } from "@papit/game-engine";
import { IrregularGrid } from "@papit/irregular-grid";
import { Structure, StructureObject, ModuleLibrary, blockModules } from "@papit/structure";

const grid = IrregularGrid.hex({ radius: 6, seed: "town", size: 1.6 });
const structure = new Structure(grid, new ModuleLibrary(blockModules()), { layers: 8, seed: "town" });
structure.set(10, 0, 1); // vertex 10, layer 0, id 1 (0 is empty)

engine.add(new StructureObject(structure)); // or read structure.update() yourself
```

Each `update()` returns only rebuilt chunks:

```typescript
for (const chunk of structure.update())
{
    chunk.mesh;      // merged render mesh (@papit/game-mesh)
    chunk.walkable;  // up facing triangles, 9 floats each
    chunk.collision; // convex hulls, e.g. new Hull(points) in @papit/rigidbody
    chunk.points;    // tagged module points: { tag, position, normal, cell, layer }
}
```

Your own modules, authored in the unit cube:

```typescript
library.add({
    id: "door", pattern: 0b00110011, geometry: doorMesh, weight: 2, tags: ["door"],
    sockets: { 0: "wall", top: "roof" },
    collision: [[[0, 0, 0], [1, 0, 0], /* ... */]],
    points: [{ tag: "door", position: [.5, 0, 0], normal: [0, 0, -1] }],
});
```

# API

| Export | Description |
| --- | --- |
| `Structure(grid, library, options)` | Occupancy per vertex and layer, `set`, `get`, `update`, `pattern`, `picked`, `frame`, `dirtyChunks` |
| `ModuleLibrary(modules, { mirror })` | Registers each module for all rotations (and mirrors) of its pattern; `candidates`, `missing` |
| `blockModules(colours)` | Placeholder blocks, one per canonical case, with collision boxes |
| `surfaceModules(colours)` | Smooth terrain modules from the `@papit/marching-cubes` table |
| `deform(mesh, frame, rotation, mirror)` | Warps a unit cube mesh into a cell, normals included |
| `touchingSides(pattern)` | Sides a pattern reaches, to give them one socket |
| `StructureObject(structure)` | `GameObject` that draws on a WebGL2 `Layer3D` |

| Option | Description |
| --- | --- |
| `layers` | Occupancy layers per vertex |
| `layerHeight` | Height of one layer, default 1 |
| `seed` | Seeds module choice, default 0 |
| `chunkSize` | Chunk size in world units, default 8 |
| `walkableSlope` | Smallest normal y counted as walkable, default 0.7 |

# Design notes

- A cell slab reads 8 corners (4 at layer k, 4 at k + 1) into an 8 bit pattern; `@papit/corner-lookup` maps it to a module and transform.
- Choice is seeded per cell, so edit order never changes the result. With sockets, the edited cells are re-solved with `@papit/wave-function-collapse`.
- Edits rebuild only the cells around the vertex; chunks merge cached cell data.
- No art or materials ship: ids, modules and colours belong to the game. The demo shows a city, farmland and terrain from the same core.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/irregular-grid](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/irregular-grid)
- [@papit/corner-lookup](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/corner-lookup)
- [@papit/marching-cubes](https://github.com/onkelhoy/papit/tree/main/packages/algorithms/marching-cubes)
- [@papit/game-engine](https://github.com/onkelhoy/papit/tree/main/packages/game/engine)
