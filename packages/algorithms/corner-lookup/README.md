# @papit/corner-lookup

Generates marching squares and marching cubes case tables: every corner pattern mapped to a canonical case plus the rotation and mirror that restore it. Reach for it for dual-grid autotiling, modular building kits or marching cubes.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/corner-lookup.svg?logo=npm)](https://www.npmjs.com/package/@papit/corner-lookup)

---

# Installation

```bash
npm install @papit/corner-lookup
```

# Usage

```typescript
import { CornerTable } from "@papit/corner-lookup";

const table = new CornerTable({ corners: 8 }); // cube, 70 cases
const pattern = CornerTable.pattern([1, 1, 0, 0, 0, 0, 0, 0]);

const { canonical, rotation, mirror } = table.lookup(pattern);
// place the module authored for `canonical`, turned `rotation` quarter turns
```

Marching squares or 2D dual-grid autotiling:

```typescript
const tiles = new CornerTable({ corners: 4 }); // 6 cases
```

# API

## CornerTable

```typescript
new CornerTable(options?: CornerTableOptions)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `corners` | `4 \| 8` | `8` | Square or cube |
| `mirror` | `boolean` | `false` | Also reduce mirror images (cube: 55 cases) |

| Member | Description |
| --- | --- |
| `lookup(pattern)` | `{ canonical, rotation, mirror }` |
| `cases` | Every canonical pattern, ascending |
| `canonical`, `rotation`, `mirrored` | The raw `Uint8Array` tables, indexed by pattern |
| `CornerTable.pattern(values)` | Bits from per-corner values, truthy is set |

## Functions

```typescript
permuteCorner(corner, rotation, mirror?): number
transformPattern(pattern, corners, rotation, mirror?): number
```

Where a corner or pattern ends up after mirroring, then rotating.

# Corner layout

Bottom corners `0..3` counter-clockwise, top corners `4..7` above them. Bit `i` is corner `i`. Rotation turns around the vertical axis; mirror maps corner `i` to `3 - i` and flips triangle winding.

# Design notes

- Generated, not hand-written: each pattern tries all 4 (or 8) transforms, the smallest result is canonical. O(2^n) build, O(1) lookup.
- When both work, a plain rotation wins over a mirror, so mirrored modules are only used when needed.
- Cases are counted per symmetry group (Burnside), tests pin them: cube 70 / 55, square 6 / 6.

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
