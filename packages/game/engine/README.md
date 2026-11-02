# @papit/game-engine

A canvas game engine for 2D and 3D, with stacked layers, one game loop, game objects and cameras. Reach for it when you build a game or simulation on canvas or WebGL without a framework.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/game-engine.svg?logo=npm)](https://www.npmjs.com/package/@papit/game-engine)

---

## Installation

```bash
npm install @papit/game-engine
```

## Usage

A game is a tree of objects drawn onto layers. Extend `GameObject`, add it to the engine and start.

```typescript
import { GameEngine, GameObject } from "@papit/game-engine";

class Ball extends GameObject {
  update(dt: number) {
    this.position.x += 100 * dt; // pixels per second
  }

  render({ ctx }) {
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2); // 0, 0 is this object
    ctx.fill();
  }
}

const engine = new GameEngine("canvas");
engine.add(new Ball());
engine.start();
```

Children move with their parent, and a camera follows what you tell it to:

```typescript
import { Camera, follow, zoom } from "@papit/game-engine";

const player = engine.add(new Ball());
player.add(new Ball()).position.y = 60;

engine.defaultLayer.camera = new Camera({
  bounds: { x: 0, y: 0, width: 3000, height: 2000 },
  controllers: [follow(player, { ease: 0.08 }), zoom()],
});
```

Stack a 2D map and a WebGL scene, each on its own canvas:

```typescript
const engine = new GameEngine(
  { name: "map", query: "#map" },
  { name: "models", query: "#models", type: "webgl2" },
);

engine.layers.map.ctx.fillRect(0, 0, 10, 10);

const icon = engine.add(new Ball());
icon.layer = "models";
```

A loop without objects works too:

```typescript
engine.loop((milliseconds, seconds) => {
  engine.ctx.clearRect(0, 0, engine.width, engine.height);
});
```

The `views/` folder has a demo for each part: `layers`, `objects`, `camera`, `camera-3d` and `input`.

## API

### GameEngine

```typescript
new GameEngine(...selectors: (string | Partial<Setting>)[])
```

Owns the layers, the world and the only loop. With no arguments it uses the selector `"canvas"` with a 2D context. It throws if an element or its context can't be found.

| Setting           | Type                                  | Default    | Description                                                      |
| ----------------- | ------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `query`           | `string`                              |            | CSS selector of the canvas                                       |
| `name`            | `string`                              | `layer<n>` | Case-insensitive. `main` or `default` makes it the default layer |
| `type`            | `"2d" \| "webgl" \| "webgl2"`         | `"2d"`     | Picks `Layer2D` or `Layer3D`                                     |
| `width`, `height` | `number`                              |            | Fixed size, the canvas then ignores its element                  |
| `global`          | `boolean`                             | `false`    | Sets `GameEngine.instance`                                       |
| `documentElement` | `Document \| HTMLElement \| ShadowRoot` | `document` | Where `query` looks                                              |
| `contextSetting`  | context attributes                    |            | Passed to `getContext`                                           |
| `callbacks`       | `SettingCallback[]`                   | `[]`       | Run every frame                                                  |
| `theme`           | `boolean`                             | `false`    | Follow the light or dark theme of the page                       |

| Member                                    | Description                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `layers`                                  | Layers by lowercase name, unnamed ones are `layer0`, `layer1`, …         |
| `defaultLayer`                            | The first layer named `main` or `default`, otherwise the first layer     |
| `layer(name?)`                            | A layer by a name only known at runtime, in any case                     |
| `world`                                   | The root `GameObject`                                                    |
| `add(object)`, `remove(object)`           | Shortcuts to `world`                                                     |
| `start()`, `stop()`, `state`              | Runs or pauses the loop, the first frame runs right away                 |
| `loop(callback)`                          | Sets a callback that runs after drawing, and starts                      |
| `time`, `deltaTime`, `frame`              | Seconds played, seconds since the last frame and frames drawn            |
| `fixedDeltaTime`                          | Seconds per fixed step, 1/60                                             |
| `timeScale`                               | 0.5 is slow motion, 0 freezes the game                                   |
| `input`                                   | `InputEvents` on the default layer, created on first use                 |
| `theme`, `foreground`                     | `"light"` or `"dark"`, and the matching `"black"` or `"white"`           |
| `on("theme", listener)`                   | Runs when the theme switches, with the new theme                         |
| `canvas`, `ctx`, `gl`, `width`, `height`  | Shortcuts to the default layer                                           |
| `GameEngine.instance`, `GameEngine.ctx`   | The engine created with `global: true`                                   |

A frame runs: resize, `fixedUpdate` steps, `update`, `lateUpdate`, cameras, `render`, the loop callback.

With `theme: true` the engine reads the theme on creation and follows both the system setting and `data-theme` on `<html>`. A switch emits `theme`, and a stopped game draws one frame so the new colours show. Without it `theme` stays `"light"`.

### Layers

One canvas each. A name you pass is typed, so `engine.layers.map` autocompletes. A layer resizes itself to its element, in device pixels, right from creation and then before each frame.

| Member                     | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `camera`                   | What the layer is seen through. Without one, units are pixels  |
| `element`, `width`, `height` | The canvas and its size in device pixels                     |
| `resize()`                 | Applies a pending size now, rarely needed                      |
| `ctx`                      | `Layer2D`: the 2D context                                      |
| `gl`, `gl1`                | `Layer3D`: the WebGL context                                   |
| `createProgram(name, vertex, fragment)` | `Layer3D`: compiles from a string or `{ url }`    |
| `useProgram(name)`, `deleteProgram(name)` | `Layer3D`: by name                              |

The first object drawing on a layer in a frame clears it. A layer no object draws on keeps what you painted. The `Layer3D` methods throw on failure, and `createProgramSafe`, `createShaderSafe`, `useProgramSafe` and `deleteProgramSafe` log instead.

### GameObject

```typescript
class Player extends GameObject { }
```

Override what you need:

| Lifecycle         | Runs                                                       |
| ----------------- | ---------------------------------------------------------- |
| `start()`         | Once, before its first update                              |
| `fixedUpdate(dt)` | At a fixed rate, for physics                               |
| `update(dt)`      | Every frame                                                |
| `lateUpdate(dt)`  | Every frame after every `update`                           |
| `render(layer)`   | Every frame. A 2D context is already placed at the object  |
| `destroy()`       | When it leaves the world                                   |

| Member                                 | Description                                                          |
| -------------------------------------- | -------------------------------------------------------------------- |
| `transform`                            | Its `Transform`                                                      |
| `position`, `rotation`, `scale`        | `Vector3`s from the transform                                        |
| `worldPosition`, `worldMatrix`         | After its parents. `worldPosition` is the same object on every read  |
| `name`, `layer`                        | `layer` picks a layer by name and children inherit it                |
| `engine`, `parent`, `children`         | Where it is in the tree                                              |
| `add(child)`, `remove(child)`          | `add` moves it from another parent, `remove` runs `destroy` down the tree |
| `find(nameOrCheck)`                    | The first match under this object                                    |
| `on`, `off`, `emit`                    | Events, it emits `start` and `destroy` itself                        |

### Transform

Position, rotation and scale are the source of truth, and `localMatrix` and `worldMatrix` are derived on read. Change the vectors in place. Rotation is Euler angles in radians, applied Z, then X, then Y. Parent through `object.add`, or `transform.parent` when using one on its own.

### Camera

```typescript
new Camera(setting?: CameraSetting)
```

Its position is the point at the center of the view. Set it with `layer.camera`. On a layer without one, 0, 0 is the top left corner.

| Setting       | Type                              | Default                         | Description                                          |
| ------------- | --------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `controllers` | `CameraController[]`              | `[]`                            | Run in order, after everything has moved             |
| `projection`  | `"orthographic" \| "perspective"` | by layer type                   | Orthographic on 2D, perspective on 3D                |
| `zoom`        | `number`                          | `1`                             |                                                      |
| `bounds`      | `{ x, y, width, height }`         |                                 | Keeps the view inside, orthographic only             |
| `ease`        | `Easing`                          | `1`                             | For controllers without their own, 1 is no easing    |
| `fov`         | `number`                          | `Math.PI / 3`                   | Vertical, in radians                                 |
| `near`, `far` | `number`                          | `0.1`, `1000`                   |                                                      |

| Member                         | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `viewMatrix`, `projectionMatrix` | For your shader uniforms on a 3D layer                       |
| `shake(duration?, magnitude?)` | Skipped when the user prefers reduced motion                   |
| `clamp()`                      | Pulls the view back inside `bounds`                            |
| `offset`                       | How far `pan` is from what `follow` aims at, set it to 0 to go back |

`Easing` is a fraction per 60 Hz frame, which moves the same at any frame rate, or a function from `dt` to the fraction for this frame.

| Controller               | Options                                  | Does                                                     |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `follow(target, options)` | `ease`, `deadzone`, `offset`            | Keeps a target centered, landing on it on the first frame |
| `zoom(options)`          | `min`, `max`, `speed`, `ease`            | Wheel zoom                                               |
| `pan(options)`           | `button`                                 | Drags the view                                           |
| `orbit(options)`         | `target`, `distance`, `min`, `max`, `yaw`, `pitch`, `sensitivity`, `speed` | Drag to circle, wheel for distance |
| `fps(options)`           | `speed`, `sensitivity`                   | Click to lock the mouse, then look and walk with WASD or arrows |

A `follow` target is a `GameObject` or anything with a `position`. A controller is `{ start?, update(camera, dt), destroy? }`, so writing your own is short.

### Input

`engine.input` gives you the `InputEvents` of the default layer, without pointer lock. Create your own for other settings. A plain `new InputEvents(canvas)` requests pointer lock on click, so pass `{ mouse: { pointerlock: undefined } }` to avoid that.

```typescript
const { input } = engine;

input.position; // Vector2, last pointer position
input.pressing; // a mouse button or touch is down
input.keyboard.key("w")?.pressed;

input.on("mouse-down", () => console.log("pressed at", input.position));
```

| Class         | Description                                                                        |
| ------------- | ---------------------------------------------------------------------------------- |
| `InputEvents` | One pointer from mouse and touch: `mouse-down`, `mouse-up`, `mouse-move`           |
| `Mouse`       | `position`, `movement`, `clicked`, and the events `move`, `down`, `up`             |
| `Touches`     | Every active touch in `touches`, and `last-down`, `last-up`, `last-move` for the primary one |
| `Keyboard`    | `key(name)` with lowercase names, and the events `<key>`, `<key>-down`, `<key>-up` |

## Design notes

- **One engine, split by canvas.** A layer is 2D or 3D, so one scene can mix both.
- **One loop.** Layers can't drift. `dt` is capped at 0.1 s, so a backgrounded tab can't jump the game, and the fixed step catches up at most 5 steps per frame.
- **Matrices are derived.** Moving an object allocates nothing. A `Vector3` can't report a change, so a read compares 9 numbers against the last ones used.
- **Input in controllers is native.** Pan, zoom, orbit and fps use pointer, wheel and pointer lock events, on the parent of the canvas so they still work under a stacked layer.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [`@papit/vector`](https://www.npmjs.com/package/@papit/vector): the vectors in a transform
- [`@papit/matrix`](https://www.npmjs.com/package/@papit/matrix): the matrices behind it
- [`@papit/pixels`](https://www.npmjs.com/package/@papit/pixels): reads images and canvases pixel by pixel
- [`@papit/confetti`](https://www.npmjs.com/package/@papit/confetti): built on this engine
