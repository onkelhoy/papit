# @papit/confetti

a simple to use confetti

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-game-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/confetti.svg?logo=npm)](https://www.npmjs.com/package/@papit/confetti)

---

`<pap-confetti>` is a canvas-based confetti burst web component, built on `@papit/game-engine` for the canvas/render loop and an internal particle system for the burst physics (rects, triangles, and circles with gravity, spread, and a soft "toward center" bias). It ships three built-in sound effects and can be triggered programmatically, by clicking the element itself, or by wiring it to an external control button.

## installation

```bash
npm install @papit/confetti
```

### to use in **html**

```html
<script type="module" defer>
  import "@papit/confetti";
</script>

<pap-confetti></pap-confetti>
```

## Usage

### Trigger it from code

```typescript
const confetti = document.querySelector("pap-confetti");

confetti.start();

// with options
confetti.start({
  amount: 200,
  sound: false,
  placement: "top-right",
});
```

`start(options?)` accepts a `Partial` of:

| Option      | Type        | Default                      | Description                                                     |
| ----------- | ----------- | ---------------------------- | --------------------------------------------------------------- |
| `amount`    | `number`    | `100`                        | number of particles to spawn for this burst                     |
| `sound`     | `boolean`   | `true`                       | whether to play the pop/yay/horn sound effects                  |
| `placement` | `Placement` | current `placement` property | overrides `placement` for this call (also updates the property) |

Calling `start()` while a burst is already animating clears the previous particles and restarts the render loop rather than stacking two loops.

### Trigger it by clicking the element

```html
<pap-confetti click></pap-confetti>
```

With the `click` attribute set, clicking the canvas fires a burst originating from the exact click position (converted from screen to canvas coordinates, accounting for canvas scaling), instead of a `placement`-based position.

### Trigger it from another button

```html
<button id="celebrate">🎉</button>
<pap-confetti aria-controls="celebrate"></pap-confetti>
```

Setting `aria-controls` to the id of an element in the same root (shadow root or document) wires a click listener on that element to call `start()`. Re-setting `aria-controls` cleans up the previous listener first.

## Attributes / Properties

| Attribute       | Property    | Type        | Default    | Description                                                            |
| --------------- | ----------- | ----------- | ---------- | ---------------------------------------------------------------------- |
| `placement`     | `placement` | `Placement` | `"bottom"` | where the burst originates from, see below                             |
| `click`         | `withClick` | `boolean`   | `false`    | if present, clicking the canvas triggers a burst at the click position |
| `aria-controls` | `controls`  | `string`    | —          | id of an external element that should trigger `start()` on click       |
| `x`             | `x`         | `number`    | —          | explicit burst origin X (overrides `placement`)                        |
| `y`             | `y`         | `number`    | —          | explicit burst origin Y (overrides `placement`)                        |

`Placement` is one of:

```
"top-left" | "top" | "top-right"
"left" | "center" | "right"
"bottom-left" | "bottom" | "bottom-right"
"random"
```

`"random"` picks a new placement from the full set on every call to `getPosition()`. If both `x` and `y` are set, they take priority over `placement` for positioning (this is also how the `click` attribute positions bursts).

## Sound effects

Three effects — `/pop.mp3`, `/yay.mp3`, `/horn.mp3` — are loaded once per page (shared statically across all `<pap-confetti>` instances) and play on every `start()` call unless `sound: false` is passed. They're expected to be served from your app's root; host your own copies at those paths, or override by placing files at `/pop.mp3`, `/yay.mp3`, and `/horn.mp3`.

## Styling

The component renders a single `<canvas>` in its shadow root and sizes it via `resizeCanvasToDisplaySize()` (from `@papit/game-engine`) whenever a burst starts, so it always matches the element's current on-screen size. Style the host element (width/height/position) as you would any block element; the canvas fills it.

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

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class
- [@papit/game-engine](https://github.com/onkelhoy/papit/tree/main/packages/game/engine): Canvas engine used internally for context setup and the render loop

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
