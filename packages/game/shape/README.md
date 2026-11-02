# @papit/game-shape

Drawable 2D shapes for canvas games: circle, rectangle, line and polygon outlines, with support functions for GJK.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/game-shape.svg?logo=npm)](https://www.npmjs.com/package/@papit/game-shape)

---

## Installation

```bash
npm install @papit/game-shape
```

## Usage

```typescript
import { Circle, DrawPolygon, Line, Rectangle } from "@papit/game-shape";
import { Polygon } from "@papit/polygon";

new Circle({ x: 100, y: 100 }, 40).draw(ctx);
new Rectangle(10, 20, 80, 40).draw(ctx, "blue", "rgba(0, 0, 255, 0.1)");
new Line({ x: 0, y: 0 }, { x: 100, y: 50 }).draw(ctx, "red", 2);

DrawPolygon(new Polygon({ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 40, y: 60 }), ctx);
```

These shapes are for drawing. For plain geometry use `@papit/polygon` and `@papit/rectangle`, and for collisions the `algorithms/math/intersection` packages.

## API

### Circle

```typescript
new Circle(center: VectorValue, radius: number)
```

| Member                                         | Description                                 |
| ---------------------------------------------- | ------------------------------------------- |
| `x`, `y`, `r`                                  | It's a `Vector3`, plus a radius             |
| `boundary`                                     | The box around it                           |
| `supportFunction(direction)`                   | The furthest point that way, for GJK        |
| `draw(ctx, strokecolor?, fillcolor?)`          |                                             |
| `Circle.toCircle(point, r)`                    | The same as the constructor                 |

### Rectangle

```typescript
new Rectangle(x: number, y: number, w: number, h: number)
```

| Member                                                    | Description                               |
| --------------------------------------------------------- | ----------------------------------------- |
| `x`, `y`, `w`, `h`, `width`, `height`                     |                                           |
| `topLeft`, `topRight`, `bottomLeft`, `bottomRight`, `center` | Plain `{ x, y }` points                |
| `polygon`                                                 | Vertices and two triangles                |
| `draw(ctx, strokecolor?, fillcolor?)`                     |                                           |

`supportFunction` isn't finished: it returns the top left corner whatever the direction.

### Line

```typescript
new Line(a: VectorValue, b?: VectorValue)
Line.DirectionLine(a: Vector2, direction: Vector2)
```

| Member                     | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| `a`, `b`, `direction`      | Setting `direction` moves `b`                                |
| `draw(ctx, color?, r?)`    | Without a `b` it draws an endless line through `a`           |
| `Line.drawDot(v, ctx, color?, r?)` | Draws one point                                      |

### DrawPolygon

```typescript
DrawPolygon(polygon: Polygon, ctx: CanvasRenderingContext2D, setting?)
```

| Setting                  | Default            | Description                     |
| ------------------------ | ------------------ | ------------------------------- |
| `strokecolor`, `fillcolor` | black, 10% black | Colors                          |
| `r`                      | `1`                | Vertex size and line width      |
| `boundary`               | `false`            | Draws the bounding box          |
| `triangles`              | `false`            | Draws the triangles             |
| `shapes`                 | `true`             | Draws the convex pieces         |

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/polygon`](https://www.npmjs.com/package/@papit/polygon): the polygon `DrawPolygon` draws
- [`@papit/moore-neighborhood`](https://www.npmjs.com/package/@papit/moore-neighborhood): polygons from an image
- [`@papit/game-engine`](https://www.npmjs.com/package/@papit/game-engine): a canvas to draw on
