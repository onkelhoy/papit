# @papit/pixels

Reads images and canvases pixel by pixel in the browser. Reach for it when game or algorithm code needs the color and position of each pixel.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-browser-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/pixels.svg?logo=npm)](https://www.npmjs.com/package/@papit/pixels)

---

## Installation

```bash
npm install @papit/pixels
```

## Usage

```typescript
import { Pixels } from "@papit/pixels";

const pixels = await Pixels.FromImage("/map.png");

pixels.get(4, 2); // { r, g, b, a, index, col, row }

for (const pixel of pixels)
{
  if (pixel.a === 0) continue;
  pixels.surrounding(pixel).top; // the pixel above, undefined at the edge
}
```

Read what is on a canvas, by element or by query:

```typescript
const pixels = Pixels.FromCanvas("canvas");
```

## API

### Pixels

```typescript
new Pixels(imageData: ImageData)
```

| Member                               | Description                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `Pixels.FromImage(image, ctx?)`      | Async. Takes an image or url. Draws on `ctx` if given, otherwise on a new canvas |
| `Pixels.FromCanvas(canvas, root?)`   | Takes a 2D canvas or a query, looked up in `root`. Throws if there's neither     |
| `get(index)`, `get(col, row)`        | A pixel, or `undefined` outside the image                                        |
| `surrounding(pixel)`                 | The 8 neighbours, by name (`top-left`, `top`, …) and as `array`                  |
| `width`, `height`                    | Size in pixels                                                                   |
| `map`, `imageData`                   | The pixels by index, and the source data                                         |

A cross-origin image without CORS headers can't be read: the browser throws on `getImageData`.

### LoadImage

```typescript
LoadImage(src: string): Promise<HTMLImageElement>
```

Resolves once the image has loaded. It never settles if the image fails to load.

### Pixel

`{ r, g, b, a, index, col, row }`, with colors and alpha from 0 to 255.

## Design notes

- **Reads once.** `Pixels` is a copy of the image at that moment. Read again after drawing.
- **One object per pixel.** Fine for maps and sprites. Don't run it every frame on a full-screen canvas.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/moore-neighborhood`](https://www.npmjs.com/package/@papit/moore-neighborhood): traces outlines from these pixels
- [`@papit/game-engine`](https://www.npmjs.com/package/@papit/game-engine): the canvas engine
