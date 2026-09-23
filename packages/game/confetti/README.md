# @papit/confetti

Canvas confetti burst web component (pap-confetti) with optional sound effects. Trigger it from code, by clicking the element, or from a linked button to celebrate a user action.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/confetti.svg?logo=npm)](https://www.npmjs.com/package/@papit/confetti)

---

# Installation

```bash
npm install @papit/confetti
```

---

# Usage

```html
<script type="module">
    import "@papit/confetti";
</script>

<pap-confetti style="width: 400px; height: 300px;"></pap-confetti>

<script type="module">
    document.querySelector("pap-confetti").start();
</script>
```

The element is `100px` by `100px` by default. Size the host like any block element and the canvas fills it.

## With options

```js
const confetti = document.querySelector("pap-confetti");

confetti.start({ amount: 200, sound: false, placement: "top-right" });
```

## Burst where the user clicks

```html
<pap-confetti click></pap-confetti>
```

## Trigger from another element

```html
<button id="celebrate">Celebrate</button>
<pap-confetti aria-controls="celebrate"></pap-confetti>
```

The element with that id is looked up in the same root (document or shadow root) when `aria-controls` is set, so it has to exist by then.

---

# API

## Attributes / Properties

| Attribute       | Property    | Type        | Default    | Description |
| --------------- | ----------- | ----------- | ---------- | ----------- |
| `placement`     | `placement` | `Placement` | `"bottom"` | Where the burst starts, see below. |
| `click`         | `withClick` | `boolean`   | `false`    | Clicking the canvas starts a burst at the click position. |
| `aria-controls` | `controls`  | `string`    | none       | Id of an element whose click calls `start()`. Setting it again removes the old listener. |
| `x`             | `x`         | `number`    | none       | Burst origin X in canvas pixels. Overrides `placement` when `y` is also set. |
| `y`             | `y`         | `number`    | none       | Burst origin Y in canvas pixels. Overrides `placement` when `x` is also set. |

`Placement` is one of `"top-left"`, `"top"`, `"top-right"`, `"left"`, `"center"`, `"right"`, `"bottom-left"`, `"bottom"`, `"bottom-right"` or `"random"` (a new one of the nine for each burst). Edge placements sit 20px in from the edge.

A click with `click` set writes the click position into `x` and `y`, so later bursts reuse that position until you change them.

## Methods

```ts
start(options?: Partial<{ amount: number; sound: boolean; placement: Placement }>): void
```

Starts a burst. Particles still flying from an earlier burst are cleared first.

| Option      | Type        | Default     | Description |
| ----------- | ----------- | ----------- | ----------- |
| `amount`    | `number`    | `100`       | Particles in this burst. |
| `sound`     | `boolean`   | `true`      | Play the pop, yay and horn sounds. |
| `placement` | `Placement` | current     | Sets the `placement` property, then bursts from it. |

`start()` needs the element to have rendered, so call it after the element is connected.

## Events

None.

---

# Sound effects

With `sound` on, every burst plays `/pop.mp3`, `/yay.mp3` and `/horn.mp3`. The paths are absolute to your site root. The package ships the files in `asset/audio/`, so copy or serve them at those paths. The audio elements are created once and shared by every `<pap-confetti>` on the page.

---

# Design notes

- The render loop only runs while particles are alive and stops by itself after the burst.
- Motion is per frame, not `delta`-based, so bursts run faster on high refresh rate screens.
- `prefers-reduced-motion` isn't respected yet. Check it yourself before calling `start()` if that matters.

---

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related

- [@papit/game-engine](https://github.com/onkelhoy/papit/tree/main/packages/game/engine)
  Canvas engine used for the canvas setup and render loop.
- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  Base class and decorators the element is built on.
