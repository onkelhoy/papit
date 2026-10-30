# @papit/markdown

Markdown preview web component: renders markdown from a URL, a property or its own text content into safe, theme-styled HTML.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-molecules-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/markdown.svg?logo=npm)](https://www.npmjs.com/package/@papit/markdown)

---

# Installation

```bash
npm install @papit/markdown
```

# Usage

```html
<script type="module">
  import "@papit/markdown";
</script>

<!-- its own text: the indentation the lines share is removed -->
<pap-markdown>
  # Hello

  Some **bold** text.
</pap-markdown>

<!-- a file -->
<pap-markdown src="/docs/intro.md"></pap-markdown>
```

```js
// a string, e.g. a live preview
document.querySelector("pap-markdown").content = "# Live\n\n- preview";
```

The source is `content` when it's set, else the fetched `src`, else the element's own text. Changing any of them renders again. The element's text is read as plain text, so a `<b>` written inside it is parsed by the browser as HTML first; put markdown that holds `<` or `&` in `content` or a file instead.

Rendering covers CommonMark plus GFM tables, task lists and ~~strikethrough~~: headings (with GitHub style `id`s, so `[x](#hello)` scrolls to them), paragraphs, emphasis, inline and fenced code (`<pre><code class="language-js">`), quotes, nested lists, tables with alignment, rules, links and images. Tokenizing is done by `markdown` from [@papit/lexer](https://github.com/onkelhoy/papit/tree/main/packages/runtime/lexer).

## Safety

The output is built from elements and text nodes only, never by parsing HTML, so raw HTML in the markdown shows as text. Links keep `http(s)`, `mailto`, relative and `#` URLs, images keep `http(s)` and relative ones. Anything else (`javascript:`, `data:`) renders as plain text. Links to another origin open in a new tab with `rel="noopener noreferrer"`. Relative URLs in a fetched file resolve against the file's URL.

# API

## Attributes and properties

| Attribute | Property | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `src` | `src` | `string` | - | URL of a markdown file to fetch and render, used when `content` isn't set |
| `content` | `content` | `string` | - | Markdown to render, wins over `src` and the element's text |
| - | `markdown` | `string` (read-only) | - | The markdown currently rendered |

## Events

| Event | Detail | Description |
| --- | --- | --- |
| `load` | - | `src` was fetched and rendered |
| `error` | `{ error }` | `src` couldn't be fetched (network error or a non-2xx response) |

## CSS parts

| Part | Description |
| --- | --- |
| `content` | The wrapper around the rendered markdown |

The rendered elements live in the shadow root and are styled with @papit/theme tokens (`--text`, `--background-dark`, `--info`, `--space-*`, `--radius-*`).

# License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/lexer](https://github.com/onkelhoy/papit/tree/main/packages/runtime/lexer) - the markdown tokenizer
- [@papit/codeblock](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/molecules/codeblock) - syntax-highlighted code with a live preview
- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component) - the base component class
