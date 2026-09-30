# @papit/carousel

An accessible, swipeable carousel built from parts: a scrolling gallery plus prev, next and dot controls you can place anywhere. Follows the WAI-ARIA Carousel pattern, with looping, autoplay and several slides per view.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/carousel.svg?logo=npm)](https://www.npmjs.com/package/@papit/carousel)

---

## Installation

```bash
npm install @papit/carousel
```

```ts
import "@papit/carousel"; // registers all five elements
```

---

## Usage

The carousel holds the state, the gallery shows the slides, and the controls go wherever your layout wants them. Nothing is rendered for you, so every part is yours to place and style.

```html
<pap-carousel aria-label="Featured articles">
    <pap-carousel-gallery>
        <article>Slide 1</article>
        <article>Slide 2</article>
        <article>Slide 3</article>
    </pap-carousel-gallery>

    <div class="toolbar">
        <pap-carousel-prev></pap-carousel-prev>
        <pap-carousel-dots></pap-carousel-dots>
        <pap-carousel-next></pap-carousel-next>
    </div>
</pap-carousel>
```

### Controls somewhere else

A control drives the carousel it sits in. Outside it, name the carousel with `aria-controls` (an id, not a selector).

```html
<pap-carousel id="news" aria-label="News">
    <pap-carousel-gallery>…</pap-carousel-gallery>
</pap-carousel>

<pap-carousel-prev aria-controls="news"></pap-carousel-prev>
<pap-carousel-next aria-controls="news"></pap-carousel-next>
```

### Your own controls

Anything can drive it through the API, and follow it through `change`.

```html
<button aria-controls="news" onclick="news.prev()">Previous</button>
<button aria-controls="news" onclick="news.slide = 0">First</button>
<button aria-controls="news" onclick="news.next()">Next</button>
```

```ts
news.addEventListener("change", () => console.log(`${news.slide + 1} / ${news.slidecount}`));
```

### Autoplay

```html
<pap-carousel autoplay duration="4000" aria-label="Highlights">
    <pap-carousel-gallery>…</pap-carousel-gallery>
    <pap-carousel-dots></pap-carousel-dots> <!-- includes the required pause button -->
</pap-carousel>
```

Rotation pauses while the pointer is over the carousel or focus is inside it.

### Several slides per view ("bleed")

Size the slides with `--size` and align them to the start. Slides then snap to, and navigate to, the scroll-padding edge, so a gutter on the scroll container lines the first slide up with your page content while the track runs to the edge.

```html
<pap-carousel loop="false" aria-label="Articles">
    <pap-carousel-gallery align="start">…</pap-carousel-gallery>
</pap-carousel>
```

```css
pap-carousel-gallery {
    --size: 30%;
}

pap-carousel-gallery::part(carousel) {
    padding-inline: var(--page-inset);
    scroll-padding-inline: var(--page-inset);
}
```

Without loop, the last slides can't scroll to the snap point, so they share one position: the end of the track. `stopcount` counts the positions (8 slides at about 3 per view give 6), `slide` is clamped to the last one, and the dots show one per position. Every dot and every `next()` moves the view, and `next()` stops at the end. With loop, every slide is a position.

---

## API

### `<pap-carousel>`

The wrapper: holds the state and the navigation. It renders only its children.

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `slide` | `slide` | `number` | `0` | Active slide (0-based). Any number may be set; the gallery wraps it (loop) or clamps it |
| `loop` | `loop` | `boolean` | `true` | Wrap around at either end |
| `autoplay` | `autoplay` | `boolean` | `false` | Rotate slides automatically |
| `play` | `play` | `boolean` | `true` | Pause (`false`) or resume autoplay |
| `duration` | `duration` | `number` | `5000` | Milliseconds per slide while autoplaying |
| — | `slidecount` | `number` | `0` | Number of slides, set by the gallery |
| — | `stopcount` | `number` | `0` | Positions the gallery can scroll to, set by the gallery. Equal to `slidecount`, except without loop and with several slides per view |
| — | `progress` | `number` | `0` | 0–1 through the current slide while autoplaying |

| Method | Description |
| --- | --- |
| `next()` | Next slide (wraps or stops at the end) |
| `prev()` | Previous slide (wraps or stops at the start) |

| Event | Description |
| --- | --- |
| `change` | The active slide changed (not fired for the initial value) |

| CSS custom property | Description |
| --- | --- |
| `--duration` | Set from `duration`, e.g. `5000ms` |

### `<pap-carousel-gallery>`

The slides: scrolling, snapping and the loop. Inside a carousel it takes `slide`, `loop` and `autoplay` from it; on its own, set them on the gallery.

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `align` | `align` | `"center" \| "start"` | `"center"` | Which slide edge snaps and marks the active slide. Use `start` for several per view |
| `loop` | `loop` | `boolean` | `true` | Copies slides onto each end so it can wrap |
| `slide` | `slide` | `number` | `0` | Active slide; wrapped or clamped into range |
| `clonecount` | `clonecount` | `number` | `3` | Copies per end while looping (at most one per slide) |
| `aria-controls` | — | `string` | — | Id of its carousel, when the gallery is not inside it |
| — | `slides` | `HTMLElement[]` | `[]` | The slide elements |
| — | `stopcount` | `number` | `0` | Positions it can scroll to (see below) |

| Slot | Description |
| --- | --- |
| _(default)_ | The slides. Each child becomes a slide; slides can be added or removed at any time |

| CSS part / property | Description |
| --- | --- |
| `::part(carousel)` | The scroll container (set the gutter here) |
| `--size` | Width of one slide, default `100%` |

| Event | Description |
| --- | --- |
| `change` | The active slide changed (not fired for the initial value) |

### `<pap-carousel-prev>` / `<pap-carousel-next>`

Outline icon buttons (`pap-button`) that call `prev()` / `next()`.

| Attribute | Description |
| --- | --- |
| `aria-controls` | Id of the carousel, when the button is not inside it |

| Slot | Description |
| --- | --- |
| `icon` | Replaces the default chevron |

### `<pap-carousel-dots>`

One dot per position the gallery can scroll to (one per slide, unless several fit in view without loop), plus the autoplay pause/play button. Renders nothing until the carousel has slides.

| Attribute | Description |
| --- | --- |
| `aria-controls` | Id of the carousel, when the dots are not inside it |

| CSS part / property | Description |
| --- | --- |
| `::part(dot)` | A dot `<button>`; the active one has `aria-disabled="true"` |
| `::part(play)` | The pause/play `pap-button`, shown when the carousel autoplays |
| `--progress` | Set on the play button, 0–1, to draw the progress ring |

The container look (border, background, radius, padding, `gap`) is on the host, so it can be restyled from outside:

```css
pap-carousel-dots {
    gap: 0.5rem;
    border: none;
    background: transparent;
}
```

---

## Accessibility

Follows the [WAI-ARIA Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

- The carousel is a `role="region"` with `aria-roledescription="carousel"`. **Give it an `aria-label`.** A gallery on its own takes that role instead.
- Each slide gets `role="group"`, `aria-roledescription="slide"`, `tabindex="0"` and a translated label ("2 of 5") unless it already has `aria-label` / `aria-labelledby`.
- The slides are a polite live region, switched off while autoplaying so rotation isn't announced.
- Autoplay pauses on hover and while focus is inside the carousel; the dots' button pauses and resumes it (WCAG 2.2.2).
- The loop copies are `aria-hidden`, `inert` and carry no `id`, so they are never announced or focused.
- Keep the controls inside the carousel where you can: the region then groups the slides with their controls. Controls elsewhere still work through `aria-controls`.
- All controls are real buttons, so Enter and Space activate them.

---

## i18n

Labels come from `@papit/translator`. Override these keys in your translation files:

| Key | Default (en) | Tokens |
| --- | --- | --- |
| `aria.prev` | `previous slide` | — |
| `aria.next` | `next slide` | — |
| `aria.slide` | `{index} of {size}` | `index`, `size` |
| `aria.dots` | `Choose slide to display` | — |
| `aria.play` | `Start slide rotation` | — |
| `aria.pause` | `Stop slide rotation` | — |

---

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

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component): Core utilities, decorators, and base component class
- [@papit/translator](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/translator): i18n singleton used for accessible labels
- [@papit/button](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/button): Button behind the prev / next and play controls
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/icon): Icons inside the controls
- [@papit/group](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/1-foundations/group): Groups the dots
