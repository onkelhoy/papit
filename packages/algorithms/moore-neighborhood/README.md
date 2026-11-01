# @papit/moore-neighborhood

Turns an image into polygons by tracing the outline of its filled pixels. Reach for it to build collision shapes or outlines from a bitmap.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-algorithm-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/moore-neighborhood.svg?logo=npm)](https://www.npmjs.com/package/@papit/moore-neighborhood)

---

## Installation

```bash
npm install @papit/moore-neighborhood
```

## Usage

```typescript
import { MooreNeighborhood } from "@papit/moore-neighborhood";

const polygons = await MooreNeighborhood("/map.png", 24);

for (const polygon of polygons)
{
  polygon.vertices; // scaled by 24, so one pixel is one tile
}
```

White and fully transparent pixels count as empty, everything else as filled. It runs in the browser, because it reads the image through a canvas.

## API

### MooreNeighborhood

```typescript
MooreNeighborhood(
  image: HTMLImageElement | string,
  scale = 1,
  noholes = true,
  anchor: Anchor = "auto",
): Promise<Polygon[]>
```

| Parameter | Description                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| `image`   | An image or a url                                                               |
| `scale`   | Multiplies every vertex                                                         |
| `noholes` | Skips shapes that start inside an earlier polygon                               |
| `anchor`  | Which point of a boundary pixel becomes the vertex                              |

| Anchor                                                     | Vertex                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `auto`                                                     | The pixel corner on the outside of the shape               |
| `top-left`, `top-right`, `bottom-left`, `bottom-right`     | That corner of every pixel                                 |
| `center`                                                   | The center of every pixel                                  |

## Design notes

- **Time** is linear in the number of pixels, since every pixel is visited and each shape traced once.
- **Collinear points** are removed, so straight runs become one edge.
- **One pixel wide parts** have no area, so they are dropped. A shape joined only by such a bridge comes back as one polygon per side.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/pixels`](https://www.npmjs.com/package/@papit/pixels): reads the image
- [`@papit/polygon`](https://www.npmjs.com/package/@papit/polygon): the polygons it returns
- [`@papit/sat`](https://www.npmjs.com/package/@papit/sat): collisions between them
