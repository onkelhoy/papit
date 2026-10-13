# @papit/analyse

Reads a web component package's source and writes analyse.json, describing each custom element's tag, properties, methods, events, states, slots, parts and CSS variables, along with its full extends chain. Use it to generate docs, editor data or framework wrappers from the code itself.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/analyse.svg?logo=npm)](https://www.npmjs.com/package/@papit/analyse)

---

# Installation

```bash
npm install @papit/analyse
```

Or run it without installing:

```bash
npx @papit/analyse
```

# Usage

From inside a package, write `analyse.json` next to its `package.json`:

```bash
npx @papit/analyse
```

As a package script:

```json
{
  "scripts": {
    "analyse": "npx @papit/analyse"
  }
}
```

From code:

```ts
import { analyseFile, analysePackage } from "@papit/analyse";

// a whole package: exported elements with the extends chain resolved
const analysis = analysePackage("packages/web/design-system/atoms/switch");
analysis.elements[0].tagName; // "pap-switch"

// one file: every class with an `extends` clause, parent left as a reference
const [core] = analyseFile("src/component.ts");
core.extends; // { className: "CustomElementInternals", import: "@papit/web-component" }
```

# CLI flags

| Flag | Default | Description |
| --- | --- | --- |
| `-o <file>` | `analyse.json` | Output file, relative to the package. |
| `--no-reuse` | off | Re-analyse every dependency instead of reusing its `analyse.json`. |

# API

## analysePackage

```ts
analysePackage(location: string, options?: { reuse?: boolean }): PackageAnalysis
```

Finds the entry files behind package.json `exports`/`main` (mapped to `src/` the way `@papit/build` does). It follows re-exports to every exported custom element class and takes tag names from `customElements.define`. Then it resolves each parent class in turn: the same package first, then the workspace, then `node_modules`. The chain stops at a built-in such as `HTMLElement`. A parent it can't find stays a `Reference`.

## analyseFile

```ts
analyseFile(file: string): Core[]
```

Analyses one source file and the stylesheets it imports. The tag name comes from `HTMLElementTagNameMap` or `customElements.define` in that file.

# What is analysed

| Field | Source |
| --- | --- |
| `properties` | Public fields. `@property({ type, attribute, reflect })` is mirrored from the engine: `attribute` is the key as written unless set, and `reflect` defaults to true whenever there is an attribute. `@query` and `@translate` fields are left out. `type` is as written; `resolvedType` is what the checker makes of an alias or indexed access (`ButtonColor` → `"primary" \| "secondary" \| …`). |
| `methods` | Public methods with their signatures. Lifecycle callbacks, `render`, `@bind` handlers and private members are left out. |
| `events` | `dispatchEvent(new Event \| CustomEvent("name"))`, including inside decorator callbacks, plus `@fires` tags. |
| `states` | `_internals.states.add("name")`. |
| `html` | `<slot name>` and `part="…"` from `` html`…` `` templates and plain strings returned by `render()`, plus `@slot` / `@csspart` tags. |
| `css` | `--x: …` declarations and `var(--x, fallback)` usages in imported `.css` files, plus `@cssprop` tags. |
| `extends` | The parent `Core`, a `Reference` (class name + import) or `{ builtin }`. |

Types the source doesn't spell out, such as an untyped initialiser, an alias or a `CustomEvent` detail, come from the TypeScript checker. It is only built when needed, once per package.

In JSDoc, only an `@` at the start of a line begins a tag, so a description can mention `@property` mid-text.

The full shape lives in [src/types.ts](https://github.com/onkelhoy/papit/blob/main/packages/runtime/cli/analyse/src/types.ts):

```ts
type PackageAnalysis = { name: string; version: string; elements: Core[] };
type Core = {
  tagName?: string; className: string; description?: string;
  source: { package?: string; file: string };
  properties: Property[]; methods: Method[]; events: Event[]; states: string[];
  html: { slots: Slot[]; parts: Part[] }; css: { variables: CssVariable[] };
  extends: Core | Reference | { builtin: string } | null;
};
```

# Reuse

When a parent class lives in another package that already has an `analyse.json`, that file is used instead of analysing the package again:

- **In the workspace**: reused only while it's newer than every file in the package's `src/` and its `package.json`.
- **In `node_modules`**: always reused. A package without `src/` can only be read from its `analyse.json`.

`--no-reuse` (or `reuse: false`) re-analyses everything that has source.

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

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  The engine whose decorators and base classes the analysis understands.
- [@papit/lexer](https://github.com/onkelhoy/papit/tree/main/packages/runtime/lexer)
  Tokenizes the HTML templates and stylesheets.
- [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/build)
  Shares the entry point mapping.
