# @papit/theme

CSS design tokens for the papit design system: colours, spacing and radii that follow light and dark mode. Force a colour scheme on any element with the data-theme attribute.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-themes-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/theme.svg?logo=npm)](https://www.npmjs.com/package/@papit/theme)

---

# Installation

```bash
npm install @papit/theme
```

---

# Usage

The package is a single stylesheet, `lib/theme.css`. Include it once per page, before your own styles.

From CSS (with a bundler or dev server that resolves bare specifiers, like `@papit/server`):

```css
@import "@papit/theme";
```

From HTML:

```html
<link rel="stylesheet" href="/node_modules/@papit/theme/lib/theme.css">
```

Then use the tokens:

```css
.card {
    background: var(--background);
    color: var(--text);
    padding: var(--space-4);
    border-radius: var(--radius-medium);
}
```

---

# What it provides

Everything sits in the `theme-base` cascade layer, so any unlayered style of yours wins without extra specificity.

- The tokens below, on `:root`.
- `color-scheme` on `:root` from `prefers-color-scheme`, plus the `data-theme` overrides.
- `*:not(:defined) { visibility: hidden }`, so custom elements don't flash before they upgrade. An element that never upgrades stays invisible.
- A circular reveal for theme switches made inside `document.startViewTransition`, centred on `--theme-transition-location` (default `80% 0%`). It's skipped under `prefers-reduced-motion`. `@papit/theme-picker` sets the location for you.

---

# Tokens

Colour tokens are written with `light-dark()`, so each one has a light and a dark value and follows the element's `color-scheme`.

| Group | Tokens | Use |
| ----- | ------ | --- |
| Brand | `--primary`, `--secondary`, `--tertiary` | Neutral greys for accents and controls |
| Semantic | `--success`, `--info`, `--warning`, `--error` | Status colours, same hue in both modes |
| Text | `--text`, `--text-secondary`, `--text-inverse` | Body text, muted text, text on an inverse surface |
| Background | `--background-light`, `--background`, `--background-dark` | Page canvas, cards and panels, borders and pressed states |
| Foreground | `--foreground-light`, `--foreground`, `--foreground-dark` | Muted, body and emphasis colours |
| Inverse | `--background-*-inverse`, `--foreground-*-inverse` (same three steps) | The opposite mode's surfaces, e.g. a dark tooltip on a light page |
| Utility | `--focus-color`, `--shade-0`, `--shade-1` | Focus rings; pure black and white that swap with the mode |
| Spacing | `--base-unit` (`0.25rem`), `--space-1` … `--space-20` | `--space-n` is `n × --base-unit` (4px steps, up to 80px) |
| Radius | `--radius-small`, `--radius-medium`, `--radius-large`, `--radius-full` | `--space-2`, `--space-4`, `--space-8`, `100vh` |

Change `--base-unit` to scale every space and radius at once. Components expose their own overrides as `--<component>-<thing>`, falling back to these tokens.

---

# Light, dark and data-theme

By default the page follows the operating system through `prefers-color-scheme`. Set `data-theme` (or the matching class) on any element to force its subtree:

| Attribute | Class | Effect |
| --------- | ----- | ------ |
| `data-theme="light"` | `.theme-light` | Light mode |
| `data-theme="dark"` | `.theme-dark` | Dark mode |
| `data-theme="opposite"` | `.theme-opposite` | The opposite of the surrounding mode |

```html
<html data-theme="dark">
    …
    <aside data-theme="opposite">Light panel on a dark page</aside>
</html>
```

`opposite` flips again when nested, but only two levels deep. It also sets `background-color: var(--background)` and `color: var(--text)`. `light` and `dark` only switch `color-scheme`, so give those sections their own background.

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

# Related Components

- [@papit/theme-picker](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/theme-picker)
  Button and menu that sets `data-theme` for the user.
- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  The engine every papit component is built on.
