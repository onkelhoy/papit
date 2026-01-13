# @papit/html

A lightweight, deterministic HTML and DOM-like implementation for Node.js.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

This library provides a minimal, predictable subset of the DOM focused on:

- Server-side HTML generation
- Tree-based manipulation
- Deterministic querying
- Zero browser globals
- No polyfills or environment magic

It is **not** a browser DOM and does not aim to be one.

![Type](https://img.shields.io/badge/Type-runtime-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/html.svg?logo=npm)](https://www.npmjs.com/package/@papit/html)

## Features

- ✅ Zero dependencies
- ✅ Small footprint
- ✅ DOM-inspired class hierarchy (`Node`, `Element`, `Text`, `Document`, `Comment`)
- ✅ Tree construction from HTML strings
- ✅ `querySelector`, `querySelectorAll`, and `closest`
- ✅ Attribute handling via `Map`
- ✅ `classList` via a simplified `DOMTokenList`
- ✅ `NodeList` / read-only array-like traversal helpers
- ✅ `innerHTML` / `outerHTML` serialization
- ✅ Deterministic, explicit behavior (no hidden browser magic)
- ✅ Explicit ownership via `ownerDocument`

---

## Core Concepts

### Document as the Node Factory

All nodes should be created via `Document`.

```ts
const doc = new Document();

const el = doc.createElement("div");
const text = doc.createTextNode("Hello");
el.appendChild(text);
```

> ⚠️ Nodes are expected to have an owning `Document`.
> Constructing nodes manually may lead to missing ownership
> and broken tree relationships.

---

## Nodes

### Node

Base class for all nodes.

Properties:

- `parentNode`
- `childNodes`
- `textContent`
- `nodeType`
- `ownerDocument`

`Node` extends `EventTarget`.

---

### Text

Represents text nodes.

```ts
const text = doc.createTextNode("Hello");
```

- `nodeType === Node.TEXT_NODE`
- `textContent` always returns a string

---

### Element

Represents HTML elements.

```ts
const el = doc.createElement("div", {
  attributes: { id: "main" },
  className: "foo bar",
});
```

Properties:

- `tagName`
- `attributes: Map<string, string | true>`
- `className`
- `classList`
- `children`

Methods:

- `appendChild`
- `removeChild`
- `closest`
- `querySelector`
- `querySelectorAll`

---

### HTMLElement

```ts
class HTMLElement<T = string> extends Element {}
```

`HTMLElement<T>` currently behaves the same as `Element` and exists
to enable future specialization and typing improvements.

---

## NodeList

`childNodes` and `children` return a **read-only, array-like NodeList**.

Supported methods:

- `forEach`
- `entries`
- `keys`
- `values`
- `item(index)`

The list itself cannot be mutated, but the nodes inside it can.

---

## classList

`classList` behaves like a **simplified DOMTokenList**.

Supported methods:

- `add`
- `remove`
- `toggle`
- `contains`

Changes are reflected in `className`.

---

## HTML Serialization

### innerHTML

- Serializes child nodes
- Setting it rebuilds the subtree

```ts
el.innerHTML = "<span>Hello</span>";
```

---

### outerHTML

- Serializes the node including its own tag
- Produces valid HTML strings

`Document.outerHTML` serializes the document’s child nodes.

---

## Querying

Limited, deterministic selector support:

- Tag selectors: `div`
- Class selectors: `.foo`
- Attribute selectors: `[id=main]`
- Text selectors: `{Hello}`
- Combined selectors: `div.foo[id=bar]{Hello}`
- Descendant and child combinators: ` `, `>`

> The sibling (`+`) combinator is parsed but currently treated as a descendant.
> Proper sibling matching may be implemented in a future release.

This is **not CSS-complete by design**.

---

## Why not jsdom?

`@papit/html` intentionally solves a different problem.

### jsdom

- Full browser DOM emulation
- Heavy
- Environment-dependent
- Complex edge cases
- Slow for simple HTML tasks

### @papit/html

- Deterministic
- Lightweight
- Explicit tree ownership
- No browser assumptions
- Ideal for:

  - Build tools
  - Static HTML generation
  - Controlled DOM manipulation
  - Testing

If you need browser fidelity — use jsdom.
If you need control and predictability — use `@papit/html`.

---

## License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Summary:**

- ✅ Free for commercial use
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.
