# @papit/codeblock

A web component for previewing and syntax-highlighting HTML, CSS, and JavaScript — with no external dependencies. Built on `@papit/lexer` for zero-overhead tokenization.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-molecules-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/codeblock.svg?logo=npm)](https://www.npmjs.com/package/@papit/codeblock)

---

## Features

- Syntax highlighting for HTML, CSS, and JavaScript via `@papit/lexer`
- Live preview panel with optional splitter (`display` attribute)
- Light/dark scheme toggle — detects and tracks the ambient color scheme from parent elements and system preference
- Collapse/expand code view with a fade-out peek
- One-click copy to clipboard
- Checkerboard, canvas, or solid background for the preview area
- No external dependencies

---

## Installation

```bash
npm install @papit/codeblock
```

---

## Usage

```html
<script type="module">
  import "@papit/codeblock";
</script>

<pap-codeblock>
  <p>Hello world</p>
  <style>
    p { color: red; }
  </style>
  <script>
    console.log("hello");
  </script>
</pap-codeblock>
```

Slot any HTML content directly — the component captures the raw HTML, formats it, and syntax-highlights it. `<style>` and `<script>` tags are detected and highlighted accordingly.

### With live preview

```html
<pap-codeblock display>
  <div>
    <span>yes</span>
    <span>no</span>
  </div>
</pap-codeblock>
```

The `display` attribute enables the preview panel with a draggable splitter between the rendered output and the code view.

---

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `display` | `boolean` | `false` | Enables the live preview panel |
| `color` | `"checker" \| "canvas" \| "background"` | `"checker"` | Background style for the preview area |

### `color` values

- `checker` — checkerboard pattern, useful for spotting transparency
- `canvas` — solid canvas color from the design token
- `background` — solid background color from the design token

---

## Color scheme

The component tracks the ambient `color-scheme` from its parent elements and the system preference. The toggle in the header flips between the ambient scheme and its opposite — so if the page is in dark mode, the toggle switches to light, and vice versa.

If the ambient scheme changes (e.g. a parent element's class is toggled), the component updates automatically as long as the toggle is in its default position.

---

## CSS custom properties

The code block exposes its theme tokens for customization:

| Property | Description |
|----------|-------------|
| `--ch-bg` | Code background |
| `--ch-text` | Default code text |
| `--ch-keyword` | Keywords (`const`, `function`, `if`, ...) |
| `--ch-keyword-2` | Secondary keywords (`async`, `await`, `while`) |
| `--ch-identifier` | Identifiers and variable names |
| `--ch-string` | String literals |
| `--ch-number` | Numeric literals |
| `--ch-operator` | Operators |
| `--ch-punctuation` | Punctuation |
| `--ch-comment` | Comments |

All tokens use `light-dark()` and respond to the component's `color-scheme`.

---

## Contributing

Contributions are welcome. Follow the development guidelines and ensure all tests pass before submitting a pull request.

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

## Related

- [`@papit/lexer`](https://github.com/onkelhoy/papit/tree/main/packages/runtime/lexer) — tokenizer powering the syntax highlighting
- [`@papit/web-component`](https://github.com/onkelhoy/papit/tree/main/packages/system/core) — base component class, decorators, and utilities
- [`@papit/splitter`](https://github.com/onkelhoy/papit/tree/main/packages/molecules/splitter) — draggable splitter used in the preview panel

---

## Support

For issues, questions, or contributions, visit the [GitHub repository](https://github.com/onkelhoy/papit).