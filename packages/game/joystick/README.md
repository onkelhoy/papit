# @papit/joystick

Touch joystick and buttons web component for browser games, with follow, floating and fixed modes and a player-editable layout.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/joystick.svg?logo=npm)](https://www.npmjs.com/package/@papit/joystick)

---

# Installation

```bash
npm install @papit/joystick
```

# Usage

The host is the touch area. Size it, then read the values in your game loop.

```html
<script type="module">
    import "@papit/joystick";

    const joystick = document.querySelector("pap-joystick");
    const loop = () => {
        player.move(joystick.x, joystick.y); // -1..1, y points down the screen
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
</script>

<pap-joystick style="position: fixed; inset: auto 0 0 0; height: 40vh">
    <pap-joystick-button id="jump">A</pap-joystick-button>
</pap-joystick>
```

By default (`follow`) the stick appears under the thumb and is dragged along past the edge. Other modes:

```html
<pap-joystick mode="floating"></pap-joystick> <!-- appears under the thumb, stays put -->
<pap-joystick mode="fixed"></pap-joystick>    <!-- stays where placed -->
```

Buttons, placed with `--x` / `--y` in percent of the area:

```html
<pap-joystick>
    <pap-joystick-button name="jump">A</pap-joystick-button>
    <pap-joystick-button name="fire" style="--x: 65%; --y: 80%">B</pap-joystick-button>
</pap-joystick>
<script type="module">
    document.querySelector("[name=jump]").addEventListener("press", () => player.jump());
</script>
```

Let the player move the controls, and keep their layout:

```js
joystick.editable = true;
joystick.addEventListener("layout-change", event => localStorage.setItem("layout", JSON.stringify(event.detail)));
joystick.layout = JSON.parse(localStorage.getItem("layout") ?? "{}");
```

# API

## pap-joystick

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `mode` | `mode` | `"follow" \| "floating" \| "fixed"` | `"follow"` | `follow` appears under the thumb and is dragged along, `floating` only appears there, `fixed` stays where placed |
| `editable` | `editable` | `boolean` | `false` | Drag the stick and buttons to new spots; input is off while editing |
| | `x` | `number` | `0` | Read-only, -1 (left) to 1 (right) |
| | `y` | `number` | `0` | Read-only, -1 (up) to 1 (down) |
| | `strength` | `number` | `0` | Read-only, 0 to 1 |
| | `layout` | `Layout` | | Positions of `stick` and buttons (by `name`, else index), in percent |

| Event | Detail | When |
| --- | --- | --- |
| `layout-change` | `Layout` | A control was dragged in `editable` mode |

| Slot | Description |
| --- | --- |
| default | `pap-joystick-button` elements |

| CSS part / property | Description |
| --- | --- |
| `base`, `stick` | The ring and the thumb |
| `--joystick-size` | Ring diameter (default `6rem`) |
| `--joystick-stick-size` | Thumb size relative to the ring (default `66.7%`) |
| `--joystick-base-color`, `--joystick-color`, `--joystick-border`, `--joystick-grain` | Ring fill, thumb fill, border and grain texture |

## pap-joystick-button

| Property | Type | Description |
| --- | --- | --- |
| `pressed` | `boolean` | Read-only, held down right now |

| Event | When |
| --- | --- |
| `press` | Pointer down on the button |
| `release` | That pointer lifted or cancelled |

Placed with `--x` / `--y` (default `80%` / `70%`), sized with `--joystick-button-size` (default `4rem`). The `pressed` attribute is set while held.

# Design notes

- No per-frame events or allocations: values are plain fields updated in pointer handlers.
- Pointer Events with pointer capture, so the stick and buttons work at the same time (multi-touch) with touch, mouse and pen.
- Released on `pointercancel`, lost capture and window `blur`, so a stick never stays stuck.
- Touch only by design: no keyboard input, use your own key handling next to it.
- No game engine dependency.

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component): the engine it is built on
- [@papit/audio](https://github.com/onkelhoy/papit/tree/main/packages/game/audio): its `views/world` demo uses the joystick
