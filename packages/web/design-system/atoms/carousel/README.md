# @papit/carousel

A fully accessible, swipeable carousel component compliant with the WAI-ARIA Carousel Pattern.

[WAI-ARIA Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/carousel.svg?logo=npm)](https://www.npmjs.com/package/@papit/carousel)

---

## Installation

```bash
npm install @papit/carousel
```

### HTML

```html
<script type="module" defer>
  import "@papit/carousel";
</script>

<pap-carousel aria-label="Featured articles">
  <article>Slide 1</article>
  <article>Slide 2</article>
  <article>Slide 3</article>
</pap-carousel>
```

### JavaScript / TypeScript

```ts
import "@papit/carousel";
```

---

## Attributes & Properties

| Property   | Attribute  | Type      | Default | Description                                             |
| ---------- | ---------- | --------- | ------- | ------------------------------------------------------- |
| `index`    | `index`    | `number`  | `0`     | The currently visible slide (0-based).                  |
| `loop`     | `loop`     | `boolean` | `true`  | Whether the carousel wraps around at either end.        |
| `autoplay` | `autoplay` | `boolean` | `false` | Enables automatic slide advancement.                    |
| `play`     | —          | `boolean` | `true`  | Pauses/resumes autoplay. Reflected via the play button. |
| `duration` | `duration` | `number`  | `5000`  | Time in milliseconds between automatic slide advances.  |
| `inline`   | `inline`   | `boolean` | `false` | Renders controls inline (below) rather than overlaid.   |

---

## CSS Parts

| Part       | Description                                 |
| ---------- | ------------------------------------------- |
| `carousel` | The inner scroll container.                 |
| `controls` | The wrapper around all navigation controls. |
| `prev`     | The previous-slide button.                  |
| `next`     | The next-slide button.                      |
| `dots`     | The `pap-group` containing dot buttons.     |
| `dot`      | Individual dot/indicator buttons.           |
| `play`     | The play/pause toggle button.               |

### Example: custom dot styling

```css
pap-carousel::part(dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

pap-carousel::part(dot)[aria-disabled="true"] {
  background: #000;
}
```

and yes, you see that correctly, the selected dot has "aria-disabled". Dont look at me look at the folks at w3. But it makes a bit sense, its disabled in terms of not being clicked because its selected.

---

## Slots

| Slot        | Description                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| _(default)_ | Slide elements. Each child is automatically assigned `role="group"`, `aria-roledescription="slide"`, and an accessible label. |

---

## CSS Custom Properties

| Property     | Description                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `--duration` | Set automatically from the `duration` property (in `ms`). Use this to drive the play-button progress animation. |
| `--progress` | Set on the play button (0–1). Drive a circular progress indicator via CSS.                                      |

---

## Public API

```ts
// Navigate programmatically
carousel.next();
carousel.prev();

// Jump to a specific slide
carousel.index = 2;

// Toggle autoplay at runtime
carousel.autoplay = true;
carousel.play = false; // pause
```

---

## Events

| Event          | Detail              | Description                              |
| -------------- | ------------------- | ---------------------------------------- |
| `slide-change` | `{ index: number }` | Fired whenever the active slide changes. |

---

## Accessibility

`pap-carousel` follows the [WAI-ARIA Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/):

- The host element carries `role="region"` and `aria-roledescription="carousel"`. **Always provide an `aria-label`** so screen readers can identify the carousel.
- The scroll region uses `aria-live="polite"` (switches to `"off"` during autoplay) and `aria-atomic="false"` so only the newly visible slide is announced.
- Each slide is annotated with `role="group"`, `aria-roledescription="slide"`, and a translated `aria-label` (e.g. "Slide 1 of 3").
- Clone slides (used for infinite loop) are hidden from assistive technology via `aria-hidden="true"` and `role="presentation"`.
- All controls are keyboard-operable buttons with translated `aria-label` values.
- Active dot carries `aria-disabled="true"` to prevent re-clicking the current slide.

---

## i18n

`pap-carousel` uses `@papit/translator`. Override the following keys in your translation files:

| Key               | Default (en)                | Tokens          |
| ----------------- | --------------------------- | --------------- |
| `aria.prev`       | `"Previous slide"`          | —               |
| `aria.next`       | `"Next slide"`              | —               |
| `aria.play`       | `"Start autoplay"`          | —               |
| `aria.pause`      | `"Stop autoplay"`           | —               |
| `aria.dots`       | `"Slide navigation"`        | —               |
| `aria.slide`      | `"Slide {index} of {size}"` | `index`, `size` |
| `aria.firstclone` | `"Clone of first slide"`    | —               |
| `aria.lastclone`  | `"Clone of last slide"`     | —               |

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class
- [@papit/translator](https://github.com/onkelhoy/papit/tree/main/packages/tools/translator): i18n singleton used for accessible labels
- [@papit/button](https://github.com/onkelhoy/papit/tree/main/packages/atoms/button): Button used for navigation controls
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/atoms/icon): Icon used inside navigation buttons

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
