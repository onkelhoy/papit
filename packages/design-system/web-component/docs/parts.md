# Parts: The Building Blocks of @papit/web-component Rendering

> File: `docs/parts.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Introduction

A **Part** is a small unit of dynamic DOM control in the `@papit/web-component` templating system.  
Every `<!--marker-->` or `<!--list-marker-->` in a compiled template becomes one or more **Part** instances in a `TemplateInstance`.

The job of a part is to:
1. Own a position in the DOM.
2. Receive a new value when `TemplateInstance.update()` runs.
3. Apply the new value efficiently, without replacing static DOM.

---

## Types of Parts

### 1. `AttributePart`
**Purpose:** Controls a single attribute value on an element.

- **Descriptor:** `{ kind: 'attr', element, name }`
- **Created when:** An attribute value contains a `<!--marker-->`.
- **apply(value):**
  - If `name === 'key'` → store in `element.__manualKey = value` (used for ListPart diffing).
  - Else → `element.setAttribute(name, value)`.
- **clear():** Removes the attribute.

**Example:**
```ts
html`<li key=${item.id} class=${isActive ? 'active' : ''}>${item.name}</li>`
````

---

### 2. `EventPart`

**Purpose:** Attaches event listeners to an element.

* **Descriptor:** `{ kind: 'event', element, name }`
* **Created when:** An attribute name starts with `on:` or `@` in the template, e.g. `@click=${handler}`.
* **apply(listener):**

  * If listener is falsy → remove existing listener.
  * Else → remove old listener (if any) and add the new one.
* **clear():** Removes current listener.

**Example:**

```ts
html`<button @click=${onClick}>Click me</button>`
```

---

### 3. `ValuePart` (single-slot)

**Purpose:** Handles a single dynamic position in text or DOM flow.

* **Descriptor:** `{ kind: 'value', marker: Comment }`
* **Created when:** `<!--marker-->` appears directly in element content or attribute-free node positions.
* **apply(newValue):**

  1. **null / falsey** → `clear()`.
  2. **Template root element** → handle as `NestedPart`.
  3. **Node** → insert node before marker.
  4. **Primitive** → set/update a Text node before marker.
* **clear():**

  * Remove text node or nested template.
  * Restore marker-only state.

**Example:**

```ts
html`<div>${message}</div>`
```

---

### 4. `NestedPart`

**Purpose:** Manages an embedded `TemplateInstance` inside a ValuePart.

* **Created when:** ValuePart receives an `Element` from `html()` (template root).
* **apply(element):**

  * First time: Create a new `TemplateInstance` from `element`, insert it, update with `getValues(element)`.
  * Subsequent times: Just update the nested instance with new values.
* **clear():**

  * Call `instance.clear()` (remove all nested parts from DOM).
  * Remove any remaining nodes.

**Example:**

```ts
html`<section>
  ${html`<h2>${title}</h2><p>${body}</p>`}
</section>`
```

---

### 5. `ListPart`

**Purpose:** Handles arrays of items and manages diffing.

* **Descriptor:** `{ kind: 'list', marker: Comment }`
* **Created when:** `<!--list-marker-->` appears in a position expecting multiple children.
* **apply(items: any\[]):**

  1. Ensure `items` is an array, else `clear()`.
  2. Build `oldKey → part` map.
  3. For each new item:

     * Resolve key: `item.key` → `@key attr` → `__manualKey` → `index`.
     * If matching part found → update it.
     * Else create new marker + ValuePart.
  4. Remove leftover parts.
* **clear():**

  * Remove all rendered nodes.
  * Reset `itemParts` and `itemValues`.

**Example:**

```ts
html`<ul>
  ${items.map(i => html`<li key=${i.id}>${i.name}</li>`)}
</ul>`
```

---

## Part Lifecycle

1. **Instantiation** (TemplateInstance constructor):

   * Call `partFactory(descriptor)` for each descriptor.
   * Store in `this.parts[]`.

2. **Update** (TemplateInstance.update):

   * Iterate over `this.parts` in order.
   * Call `part.apply(values[index], oldValues[index])`.
   * Store `oldValues` for future diffing.

3. **Clear**:

   * Call `part.clear()` for each part.

---

## Performance Tips

* **Key stability:** Always supply a stable key for `ListPart` when items can reorder.
* **Primitive reuse:** Let ValuePart reuse text nodes by passing strings/numbers, not new DOM each time.
* **Nested caching:** If you can reuse the same nested `html` result for static subtrees, you save DOM creation.

---

## Related Docs

* [Advanced Rendering Internals](./advanced.md)
* [HTML Tagged Template System](./html/README.md)
* [Custom Elements](./custom-element.md)
* [Decorators](./decorators/README.md)

