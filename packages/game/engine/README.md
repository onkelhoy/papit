# @papit/game-engine

a game engine dealing with both 2d and 3d

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/game-engine.svg?logo=npm)](https://www.npmjs.com/package/@papit/game-engine)

---

`@papit/game-engine` provides two building blocks for canvas-based games:

- **`Engine`** — canvas/context setup (`2d`, `webgl`, `webgl2`), device-pixel-aware resizing, and WebGL shader/program helpers.
- **Input** — `Mouse`, `Touches`, `Keyboard`, and a unified `InputEvents` wrapper that normalizes mouse and touch into a single pointer.

## installation

```bash
npm install @papit/game-engine
```

## Quick start

```typescript
import { Engine } from "@papit/game-engine";

// defaults to a "canvas" selector and a 2d context
const engine = new Engine();

engine.loop((delta) => {
  const ctx = engine.ctx;
  ctx.clearRect(0, 0, engine.width, engine.height);
  // draw here
});
```

```typescript
import { InputEvents } from "@papit/game-engine";

const input = new InputEvents(engine.canvas);

input.addEventListener("mouse-down", () => {
  console.log("pressed at", input.position);
});
```

## Engine

`Engine` wraps one or more `<canvas>` elements, initializes their rendering context(s), and keeps their backing-store size in sync with their displayed size.

### Creating an engine

```typescript
new Engine(...selectors: (string | Partial<Setting>)[])
```

- Called with no arguments, it defaults to the selector `"canvas"` with a `2d` context.
- A `string` argument is treated as a CSS selector for a `2d` canvas.
- An object argument (`Partial<Setting>`) lets you configure a single canvas explicitly:

```typescript
type EngineSettings = {
  query?: string; // CSS selector, resolved via documentElement
  type?: "2d" | "webgl" | "webgl2"; // default "2d"
  width?: number;
  height?: number;
  callbacks?: SettingCallback[];
  documentElement?: Document | HTMLElement | ShadowRoot; // default document
  contextSetting?: CanvasRenderingContext2DSettings | WebGLContextAttributes;
};
```

Pass multiple selectors/settings to manage several canvases from one `Engine` instance — each is tracked at its own `index` (in the order passed in, starting at `0`).

```typescript
const engine = new Engine(
  { query: "#background", type: "2d" },
  { query: "#scene", type: "webgl2" }
);

engine.ctx; // context for index 0 ("#background")
engine.getContext(1); // context for index 1 ("#scene")
```

If a matching element can't be found, or its context can't be created, the constructor throws.

### Resizing

Each observed canvas is watched with a `ResizeObserver` (`device-pixel-content-box` when supported, falling back to `content-box`). The observer only records the target display size — call `resizeCanvasToDisplaySize(index)` inside your render loop to actually apply it to the canvas's `width`/`height`:

```typescript
engine.loop((delta) => {
  engine.resizeCanvasToDisplaySize(); // index defaults to 0
  // ...draw
});
```

It returns `true` if a resize was applied, `false` otherwise.

### Accessors (index defaults to `0`)

| Getter/Method                                          | Returns                                |
| ------------------------------------------------------ | -------------------------------------- |
| `engine.canvas` / `engine.element`                     | the `HTMLCanvasElement`                |
| `engine.setting`                                       | the resolved `Setting` for that canvas |
| `engine.context` / `engine.ctx`                        | `CanvasRenderingContext2D`             |
| `engine.gl`                                            | `WebGL2RenderingContext`               |
| `engine.gl1`                                           | `WebGLRenderingContext`                |
| `engine.width` / `engine.height`                       | current canvas pixel size              |
| `engine.getSetting(index)`                             | `Setting` for a given index            |
| `engine.getContext<T>(index)`                          | context for a given index, cast to `T` |
| `engine.getElement(index)` / `engine.getCanvas(index)` | canvas element for a given index       |

### The render loop

```typescript
engine.loop((delta: number) => {
  // delta is milliseconds since the previous frame, -1 on the first frame
}, /* index */ 0);

engine.stop(/* index */ 0);
```

`loop` drives itself via `requestAnimationFrame` and stops as soon as that canvas's internal state is set to `"paused"` (which `stop()` does for you). Any callbacks registered on the setting's `callbacks` array are also invoked each frame alongside the one passed to `loop`.

### WebGL helpers

For canvases created with `type: "webgl"` or `"webgl2"`, `Engine` tracks compiled programs by name:

```typescript
const program = await engine.createProgram(
  "main",
  vertexSource,
  fragmentSource,
  /* index */ 0
);
engine.useProgram("main", 0);
// ...
engine.deleteProgram("main", 0);
```

- `vertex`/`fragment` accept either a raw shader string or `{ url: string }`, in which case the source is fetched.
- Each of `createProgram`, `createShader`, `useProgram`, and `deleteProgram` throws on failure and has a `*Safe` counterpart (`createProgramSafe`, `createShaderSafe`, `useProgramSafe`, `deleteProgramSafe`) that logs the error and returns `null`/`false` instead.
- All of these throw if the target canvas wasn't created with a WebGL context.

### LoadImage

```typescript
import { LoadImage } from "@papit/game-engine";

const img = await LoadImage("/sprites/player.png");
ctx.drawImage(img, 0, 0);
```

Resolves once the image has finished loading.

## Input

### InputEvents

`InputEvents` is the recommended entry point — it wires up `Mouse`, `Touches`, and `Keyboard` for a canvas and exposes a single normalized pointer.

```typescript
const input = new InputEvents(canvas, {
  mouse: { pointerlock: false },
  verbose: false,
});

input.position; // Vector2 — last known pointer position (mouse or touch)
input.movement; // Vector2 — delta since last update
input.pressing; // boolean — is a mouse button/touch currently down
```

Events (via `addEventListener` / `input.on(...)`):

| Event        | Fires when                             |
| ------------ | -------------------------------------- |
| `mouse-down` | mouse or the primary touch goes down   |
| `mouse-up`   | mouse or the primary touch is released |
| `mouse-move` | mouse or the primary touch moves       |

`input.on(eventname, callback)` also forwards to the underlying `mouse`/`touch` (`"move"`, `"down"`, `"up"`, `"cancel"`) and keyboard events, falling back to `keyboard.on(...)` for anything else. Keyboard-specific access:

```typescript
input.key("w"); // current KeyInfo for "w", if any
input.onkey("w", callback); // listen for the "w" custom event
```

### Mouse

```typescript
const mouse = new Mouse(canvas, setting);
```

- Tracks `position` / `movement` as `Vector2`, and `clicked` / `click.{start,end,button}` state.
- Supports two modes based on `setting.pointerlock`:
  - **Unlocked (default):** listens to `document` `mousemove` and reports absolute position deltas.
  - **Pointer lock:** clicking the canvas requests `Pointer Lock`, after which movement comes from `movementX`/`movementY`.
- Events: `"move"`, `"down"`, `"up"`.
- `mouse.draw(ctx, strokecolor?, fillcolor?, thickness?)` draws a debug circle at the current position.

### Touches

```typescript
const touches = new Touches(canvas);
```

- Tracks every active touch in `touches` (by `identifier`) as an `ExtendedTouch`, plus a single `mouse`-equivalent "primary" touch used for `position`/`movement`.
- Events: `"down"`, `"up"`, `"move"`, `"cancel"` (fire for any touch), and `"last-down"` / `"last-up"` / `"last-move"` (fire only for the primary touch).
- `ExtendedTouch` wraps the native `Touch`, adding `position`/`movement` as `Vector2`, plus `start`/`end` timestamps set via `release()`.

### Keyboard

```typescript
const keyboard = new Keyboard();

keyboard.on("w", (e) => console.log(e.detail.value)); // fires on down and up
keyboard.on("w-down", (e) => {
  /* key pressed */
});
keyboard.on("w-up", (e) => {
  /* key released */
});

keyboard.key("w"); // { clicked: boolean, start?: number, stop?: number }
```

Listens globally on `document` (not scoped to a canvas). Key names are lower-cased `event.key`/`event.code`. `handlekeyup` throws if a `keyup` arrives for a key that was never registered — this shouldn't normally happen in a browser context.

## Types

`Setting` is a discriminated union on `type`:

```typescript
type Setting = StandardSetting | WebGLSetting | WebGL2Setting;

type BaseSetting = {
  query: string;
  state: "running" | "paused";
  width: number;
  height: number;
  timer: null | number;
  previous: null | number;
  callbacks: SettingCallback[];
  documentElement: Document | HTMLElement | ShadowRoot;
};
```

`InfoType` (internal per-canvas record) is similarly split into `StandardInfo` (`CanvasRenderingContext2D`) and `GLInfo` (`WebGLRenderingContext | WebGL2RenderingContext`, plus a `programs` map).

`ShaderSource` is either a raw shader string or `{ url: string }` to fetch it.

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
