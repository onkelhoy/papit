# @papit/2d-spritesheet

Draws frames from a 2D spritesheet on a canvas and plays frame animations.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/2d-spritesheet.svg?logo=npm)](https://www.npmjs.com/package/@papit/2d-spritesheet)

---

## Installation

```bash
npm install @papit/2d-spritesheet
```

## Usage

```typescript
import { Spritesheet, SpriteAnimator } from "@papit/2d-spritesheet";

const sheet = new Spritesheet("/hero.png", 4, 8); // 4 rows, 8 columns
await sheet.load();

const animator = new SpriteAnimator({
  idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
  jump: { frames: [8, 9, 10], fps: 12, loop: false },
}, "idle");

function draw(milliseconds: number) {
  animator.update(milliseconds);
  sheet.draw(ctx, animator.frame, { x: 100, y: 200, pivotx: 50, pivoty: 100 });
}
```

## API

### Spritesheet

```typescript
new Spritesheet(image: HTMLImageElement | string, row: number, col: number, padding = 0)
new Spritesheet(image: HTMLImageElement | string, config: { row?, col?, padding? })
```

| Member                               | Description                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `load()`                             | Async. Call it before drawing                        |
| `draw(ctx, index, options?)`         | Draws a frame, counted left to right and then down   |
| `draw(ctx, col, row, options?)`      | Draws a frame by position                            |
| `frameWidth`, `frameHeight`          | Size of a frame, `null` until loaded                 |

| Option            | Default    | Description                                     |
| ----------------- | ---------- | ----------------------------------------------- |
| `x`, `y`          | `0`        | Where to draw                                   |
| `width`, `height` | frame size | Size on the canvas                              |
| `pivotx`, `pivoty` | `0`       | Percent, which point of the sprite `x, y` is    |

### SpriteAnimator

```typescript
new SpriteAnimator(animations: Record<Name, SpriteAnimation>, initial: Name)
```

`SpriteAnimation` is `{ frames: number[], fps: number, loop: boolean }`.

| Member                  | Description                                                                      |
| ----------------------- | -------------------------------------------------------------------------------- |
| `update(delta)`         | Advances time, in milliseconds                                                   |
| `play(name, onComplete?)` | Switches clip. Playing the current one does nothing, so it's safe every frame  |
| `frame`, `name`         | The frame to draw and the current clip                                           |

`onComplete` runs when a clip without `loop` reaches its last frame.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/pixels`](https://www.npmjs.com/package/@papit/pixels): loads the image
- [`@papit/game-engine`](https://www.npmjs.com/package/@papit/game-engine): a loop to draw it from
