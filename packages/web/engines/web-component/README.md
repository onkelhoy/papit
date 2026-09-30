# @papit/web-component

Base classes, decorators and an html template tag for building web components from scratch. Every papit component is built on it: reactive properties, attribute reflection, fine-grained DOM updates and form association, with no dependencies.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-engine-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/web-component.svg?logo=npm)](https://www.npmjs.com/package/@papit/web-component)

---

# Installation

```bash
npm install @papit/web-component
```

The decorators are TypeScript legacy decorators, so set `"experimentalDecorators": true` in your `tsconfig.json`.

---

# Usage

```ts
import { CustomElement, html, property, query, bind, debounce } from "@papit/web-component";
import sheet from "./style.css" with { type: "css" };

class MyCounter extends CustomElement {
    static sheet = sheet;

    @property({ type: Number, rerender: true }) count = 0;
    @query("#increment") incrementButton!: HTMLButtonElement;

    @bind
    @debounce(300)
    handleIncrement() {
        this.count++;
    }

    @bind
    handleReset() {
        this.count = 0;
    }

    render() {
        return html`
            <h2>Count: ${this.count}</h2>
            <button id="increment" @click=${this.handleIncrement}>+1</button>
            <button @click=${this.handleReset}>Reset</button>
        `;
    }
}

customElements.define("my-counter", MyCounter);
```

```html
<my-counter count="5"></my-counter>
```

---

# API

Full per-feature docs live in [`docs/`](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component/docs).

## CustomElement

```ts
class CustomElement extends HTMLElement {
    constructor(settings?: Partial<ShadowRootInit> & Partial<ElementSetting>)
}
```

Base class. Attaches an open shadow root, renders `render()` into it on connect, and patches only the changed parts on each update.

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `mode`, `delegatesFocus`, … | `ShadowRootInit` | `mode: "open"` | Passed to `attachShadow` |
| `lightDOM` | `boolean` | `false` | Render into the element itself instead of a shadow root |
| `requestUpdateTimeout` | `number` | `50` | Debounce for `requestUpdate()`, in ms |
| `throttleUpdateTimeout` | `number` | `50` | Throttle for `throttleUpdate()`, in ms |

| Member | Description |
| ------ | ----------- |
| `render()` | Override. Return an `html` template, a string or a Node, or `null` / `undefined` / `""` to render nothing |
| `firstRender()` | Runs after the first render with content. Overrides **must** call `super.firstRender()`, which adopts `static sheet` / `static sheets` |
| `update()` | Render now |
| `requestUpdate()` | Debounced `update()` |
| `throttleUpdate()` | Throttled `update()` |
| `shadowQuery(selector)` / `shadowClosest(selector)` | `querySelector` / `closest` that walk up through shadow roots |
| `root` | The shadow root, or the element itself in light DOM mode |
| `static sheet`, `static sheets` | `CSSStyleSheet`s adopted into the shadow root |

Fires `first-render` after the first render with content. `disconnectedCallback` is empty: if you add listeners or observers in `connectedCallback`, remove them there.

`render()` may change what it returns between updates:

```ts
render() {
    if (this.items.length === 0) return null;                  // nothing rendered (yet)
    if (this.compact) return html`<span>${this.items.length}</span>`;
    return html`<ul>${this.items.map(i => html`<li key=${i}>${i}</li>`)}</ul>`;
}
```

The same template is patched in place. A different one (another `html` call site, or a different string) replaces what is rendered, and so does nothing: the rendered nodes are removed, `@query` references into them are reset, and the next content mounts fresh. In light DOM mode only the rendered nodes are removed, never the element's own children.

## CustomElementInternals

```ts
class CustomElementInternals extends CustomElement
```

`CustomElement` plus form association (`static formAssociated = true`). Adds `this._internals` (`ElementInternals`), a `disabled` property mirrored to `aria-disabled` and kept in sync with a disabled `<fieldset>`, and protected `checkValidity()`, `reportValidity()` and `setValidity(flags, message, anchor)`. Style custom states with `this._internals.states` and `:state(name)`.

## html

```ts
html`<template>`: Node
html(markup: string): Node
unsafeHTML(markup: string): UnsafeHTML
```

Tagged template. The first render builds the DOM once; later renders update only the bound parts.

| Binding | Example |
| ------- | ------- |
| Text or node | `<p>${text}</p>` |
| Attribute | `<div class="card ${cls}">` |
| Standalone attribute (a falsy value or `"false"` removes it) | `<option ${selected && "selected"}>` |
| Event listener (`@` or `on` prefix) | `<button @click=${this.handleClick}>` |
| List | `${items.map(i => html`<li key=${i.id}>${i.name}</li>`)}` |
| Raw HTML | `${unsafeHTML("<b>trusted only</b>")}` |

Listeners are attached as passed, so bind methods with `@bind`. `getValues(node)` returns the values bound into a template node; the element uses it internally.

## Decorators

| Decorator | Purpose |
| --------- | ------- |
| `@property` / `@property(settings)` | Reactive property synced with an attribute |
| `@query` / `@query(selector)` / `@query(settings)` | Reference to an element in the shadow root (or, with `outside`, around the element), resolved after each render until found. Selector defaults to the property name |
| `@bind` | Binds a method to the instance on first access |
| `@debounce` / `@debounce(delay \| name \| { delay, name })` | Debounces a method. Default delay `300` ms. With `name`, adds the debounced version under that name and keeps the original |
| `@throttle` / `@throttle(delay \| name \| { delay, name })` | Same, throttled |
| `@context` / `@context(settings)` | Reads a value from the nearest ancestor that has the property or attribute (or the element its `query` names), and follows its changes |

### @property settings

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `type` | `Function` | — | Coerces attribute strings: `Number`, `Boolean`, `Object`, `Array`, … |
| `attribute` | `boolean \| string` | `true` | Attribute name, `true` for the property name, `false` for none |
| `reflect` | `boolean` | `true` | Write property changes back to the attribute |
| `removeAttribute` | `boolean` | `true` | Remove the attribute when the value is `false`, `null` or `undefined` |
| `rerender` | `boolean` | `false` | Call `requestUpdate()` when the value changes |
| `aria` | `string` | — | Mirror the value to this ARIA attribute |
| `readonly` | `boolean` | `false` | Throw a `TypeError` on any assignment after the initial value |
| `context` | `boolean` | `false` | Fire `context-<name>` on change, for `@context` consumers |
| `before(value, old, initial, attributeUpdate)` | `function` | — | Runs before the value is stored |
| `after(value, old, initial, attributeUpdate)` | `function` | — | Runs after the value is stored (on connect, for values set before the first connect) |
| `set(value)` / `get(value)` | `function` | — | Transform on write / on read. `set` may return a promise |
| `hasChanged(value, old)` | `function` | — | Custom change check |
| `maxReqursiveSteps` | `number` | `20` | Depth limit when comparing nested objects |

Attribute reflection and `after` hooks are deferred until the element is connected, so `document.createElement` works.

### @query settings

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `selector` | `string \| (this) => string` | property name | CSS selector; a function is called with the element as `this` |
| `outside` | `boolean` | `false` | Look outside the shadow root with [`findTarget`](#functions): a single match in the element's root, else the nearest matching ancestor. Falls back to the shadow root |
| `load(element)` | `function` | — | Runs once the element is found |
| `error()` | `function` | — | Runs after each render that still finds nothing |

```ts
// the carousel named by aria-controls, else the pap-carousel this button sits in
@query<Carousel>({
    outside: true,
    selector(this: Next) {
        const id = this.getAttribute("aria-controls");
        return id ? `#${CSS.escape(id)}` : "pap-carousel";
    },
}) carousel: Carousel | null = null;
```

### @context settings

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `query` | `string \| (this) => string` | — | Selector for the provider when it is not an ancestor (e.g. `#id` from `aria-controls`). An empty result walks up as usual |
| `name` | `string` | property name | Property to read on the provider |
| `attribute` | `string` | property name | Attribute to read when the provider has no such property |
| `applyattribute` | `boolean` | `false` | Also set the value as an attribute on the consumer |
| `rerender` | `boolean` | `true` | Call `requestUpdate()` when the value changes |
| `update(value)` | `function` | — | Runs on every change |

## Functions

| Function | Description |
| -------- | ----------- |
| `debounceFn(fn, delay = 300)` | Debounced wrapper |
| `throttleFn(fn, delay = 300)` | Throttled wrapper |
| `FormatNumber(value, locale = "en-US", options?)` | `Intl.NumberFormat` with a cached formatter. `STANDARD_OPTIONS` gives compact notation |
| `ExtractSlotValue(slot)` | Non-empty text of a slot's assigned nodes, as `string[]` |
| `lerp(a, b, t)` / `lerpValue(value, min, max, newmin, newmax)` | Interpolate, or remap between ranges |
| `generateUUID()` | Random v4 UUID |
| `CumulativeOffset(element)` | `{ top, left }` relative to the document |
| `nextParent(element)` | Parent element, or the shadow host at a shadow root |
| `findTarget(element, query?, finder?)` | Finds a related element. A `query` with exactly one match in the element's root returns it; otherwise it walks up from the parent (through shadow hosts), returning the first element `finder` accepts, or that matches the query. `null` if nothing does |
| `resolve(value)` | Awaits a value, a promise or a function returning either |

`STANDARD_DELAY` (`300`) is exported too.

---

# Known issues

- Keyed lists can reuse the wrong DOM nodes when items are reordered ([#99](https://github.com/onkelhoy/papit/issues/99)).
- Some references are kept after disconnect ([#83](https://github.com/onkelhoy/papit/issues/83)).

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

# Acknowledgements

💌 Special thanks to my loving wife **Phuong** — your support and patience make all the difference. 💛

---

# Related Components

- [@papit/switch](https://github.com/onkelhoy/papit/tree/main/packages/web/design-system/atoms/switch)
  A complete component built on the engine.
- [@papit/translator](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/translator)
  The `@translate` decorator for engine components.
