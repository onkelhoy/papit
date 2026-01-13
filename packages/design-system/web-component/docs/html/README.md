# HTML Tagged Template System

> File: `docs/html/README.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Introduction

`@papit/web-component` uses a **tagged template literal** system to turn HTML-like syntax into a **DOM fragment** with **dynamic value placeholders** (markers).  
This is the foundation for efficient, partial DOM updates.

The key pieces are:

- **`html()`** → entry point for creating template instances from template literals.
- **`compile()`** → transforms static HTML strings into a `DocumentFragment` with markers.
- **Markers** → comment nodes (`<!--marker-->` and `<!--list-marker-->`) that indicate dynamic insertion points.
- **`getValues()`** → extracts dynamic values and creates **Part descriptors**.
- **`TemplateInstance`** → uses descriptors to bind values to parts.

---

## 1. `html()` Usage

```ts
import { html } from "@papit/web-component/html";

const template = html`
  <div class="card">
    <h2>${title}</h2>
    <p>${content}</p>
    <ul>
      ${items.map(item => html`<li key=${item.id}>${item.label}</li>`)}
    </ul>
  </div>
`;
````

**Key Points:**

* The `html` function **returns an `Element`** (the root of your template).
* Dynamic values (`${}`) are not inserted immediately — they are replaced with markers in the initial DOM.
* When `TemplateInstance` runs `.update(values)`, the markers are replaced with the correct dynamic content.

---

## 2. How Compilation Works

When `html()` is called:

1. **Static strings** from the template literal are joined with **marker placeholders** where dynamic values go.
2. This HTML string is parsed into a `DocumentFragment` using a `<template>` element internally.
3. Every dynamic position is replaced by:

   * A **comment node** marker (`<!--marker-->`) for single values.
   * A **comment node** list marker (`<!--list-marker-->`) for arrays.
4. A set of **Part descriptors** is generated to record:

   * Where the marker is in the DOM.
   * Whether it’s an attribute, event, text node, or list.

---

## 3. Markers

Markers are special invisible nodes inserted where dynamic values will be rendered.

* **`<!--marker-->`** → A single-slot placeholder for a `ValuePart` or `NestedPart`.
* **`<!--list-marker-->`** → Marks a list location for a `ListPart`.

**Example:**

```html
<div>
  <!--marker-->
</div>
```

Later, `ValuePart.apply("Hello")` changes this to:

```html
<div>
  Hello
</div>
```

---

## 4. `getValues()`

**Purpose:**
Walks the DOM of a compiled template and **returns a flat array of initial dynamic values**
and a **parallel array of Part descriptors**.

* For each dynamic position:

  * If it’s an attribute: create an `AttributePart` descriptor.
  * If it’s an event: create an `EventPart` descriptor.
  * If it’s in text/child position: create a `ValuePart` descriptor.
  * If it’s an array position: create a `ListPart` descriptor.

**Signature:**

```ts
function getValues(root: Element): any[] | null;
```

If no dynamic values are found, returns `null`.

---

## 5. Example: Under the Hood

Given:

```ts
const tmpl = html`<button @click=${onClick}>${label}</button>`;
```

**`compile()` output:**

```html
<button>
  <!--marker-->
</button>
```

**Part descriptors:**

```json
[
  { kind: "event", element: "button", name: "click" },
  { kind: "value", marker: "<!--marker-->" }
]
```

**Values:**

```json
[ onClick, label ]
```

`TemplateInstance.update(values)` then:

* Sets `@click` listener.
* Inserts label into the text position.

---

## 6. Nesting Templates

You can pass the result of `html()` into another `html()`:

```ts
const sub = html`<span>${subtext}</span>`;
const main = html`<div>${sub}</div>`;
```

When `main` updates, the `ValuePart` detects that its new value is a template root element, and upgrades to a `NestedPart`.

---

## 7. Lists

Arrays are rendered using `ListPart` and `<!--list-marker-->`:

```ts
html`<ul>
  ${items.map(item => html`<li key=${item.id}>${item.label}</li>`)}
</ul>`
```

When updated:

* `ListPart` diffs old/new arrays by key.
* Reuses or creates `ValuePart`s for each array element.
* Removes orphaned DOM nodes.

---

## 8. Related Links

* [Parts System](../parts.md)
* [Advanced Rendering Internals](../advanced.md)
* [Custom Elements](../custom-element.md)
* [Decorators](../decorators/README.md)
