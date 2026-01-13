# Advanced: Internals of `CustomElement` (expanded — parts & lists)

> File: `docs/advanced.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

## Overview

This doc explains the engine internals powering `@papit/web-component`:
- the `html()` compile/getValues flow,
- `TemplateInstance` and `partFactory`,
- **Parts** (value, list, nested, attribute, event),
- list diffing and keys,
- update ordering and common pitfalls.

---

## Quick render lifecycle

1. `CustomElement.update()` calls `this.render()` and wraps strings with `html\``.
2. `html()` returns a *compiled Element prototype* (a clone of a cached element) and stores the dynamic `values` array on the clone via a `WeakMap`.
3. On first render:
   - root element is appended to the host.
   - `new TemplateInstance(root, partFactory)` is created — descriptors are collected and parts are instantiated.
4. On subsequent renders:
   - call `render()` to build a *fresh clone* (used only to extract `values` via `getValues()`).
   - pass `values` to `templateInstance.update(values)`.
   - `TemplateInstance` iterates parts and calls `part.apply(newValue)`.

> Why clone? We only call `render()` to get the *values array* the template produced. The actual DOM is the already appended instance; `TemplateInstance.update()` maps new values onto that live DOM via parts.

---

## Markers & descriptors

When compile() converts the template strings, it inserts markers:
- `<!--marker-->` — a *single-slot* value marker (used for text, node or nested template)
- `<!--list-marker-->` — a *list* marker (used to signal arrays in the expression position)

`getDescriptors(root)` walks the DOM (elements + comments) and returns `PartDescriptor[]` with kinds:
- `{ kind: 'value', marker: Comment }`
- `{ kind: 'list',  marker: Comment }`
- `{ kind: 'attr', element: Element, name: string }`
- `{ kind: 'event', element: Element, name: string }`

Important: **attribute descriptors must be processed before comment/list descriptors** during instance creation and update. Attributes set element state (e.g. `key`) that the list diff relies on.

---

## Part types (behaviour summary)

### AttributePart
- Created for attributes whose value was `<!--marker-->`.
- `apply(value)` sets the attribute (with a special-case for `"key"` that also stores `element.__manualKey = value`).
- `clear()` removes the attribute.
- **Note**: setting attributes may not reflect on `element.getAttribute()` synchronously in every case — the code uses a manual `__manualKey` to avoid timing issues.

### EventPart
- Created and *the original attribute is removed* during descriptor collection (we don't want inline `onclick` duplicates).
- `apply(listener)` attaches/removes event listeners.
- `clear()` removes the listener.

### ValuePart (single-slot)
- Handles primitive → text, Node → node, and nested (template root element) → nested instance.
- On apply:
  1. If `newValue` is null/false → `clear()` (remove rendered node or nested instance).
  2. If `newValue` is an Element compiled by `html()` (it is a template root) → create or update a `NestedPart` (or create nested `TemplateInstance`).
  3. If `newValue` is a Node → insert it.
  4. Else → render as a `Text` node (in-place update of text node if possible).
- `clear()` removes node or nested instance.

### NestedPart
- Wraps a `TemplateInstance` for nested templates (when a value slot contains `html` output).
- `apply(element)`:
  - If no instance: call `helpers.createTemplateInstance(element)` and insert the element before the marker, then update with `getValues(element)`.
  - If instance exists: `instance.update(values)`.

### ListPart (array-slot)
- Receives arrays only. If the value is not an array it `clear()`s.
- Maintains arrays: `itemParts[]` and `itemValues[]`.
- For each new item:
  - Compute `key = getKey(item, index)` — order of precedence:
    1. `item.key` (explicit object key)
    2. `element.getAttribute('key')` if the item is an Element and attribute !== placeholder
    3. `element.__manualKey` (set by `AttributePart` when rendering `key=${...}`)
    4. fallback to `index`
  - If an existing part with that key exists → `part.apply(item, oldItemValue)` (reuse).
  - Else create a new marker comment `<!--item-marker-->`, insert it before the parent marker and create a `ValuePart` (via `helpers.createPart`) for that marker.
- After iteration remove stale parts (keys not present anymore).
- **Ordering**: ListPart is responsible for ensuring item markers/parts are in the correct document order. It may need to reorder markers or create them in the right place.

---

## Example: template code

```ts
// items without keys — stable by position only
html`
  <ul>
    ${items.map(i => html`<li>item: ${i}</li>`)}
  </ul>
`

// items with explicit keys (recommended)
html`
  <ul>
    ${items.map((item, idx) => html`<li key=${item.id}>${item.name}</li>`)}
  </ul>
`
````

**When to provide manual keys**

* Provide a stable key when items can be reordered or spliced. Without a stable key, ListPart will fallback to index and may create/destroy parts on reorder.

---

## Ordering: attributes vs comment parts

Because a list may depend on attributes (e.g. `<li key=${i}>`), the system must apply attribute parts *before* comment/list parts. This is handled by:

* Collecting attribute parts first in `getDescriptors(root)`.
* Instantiating/applying attributes before comment/list parts in `TemplateInstance` (or delaying comment updates until after attributes have been applied).

This avoids relying on `element.getAttribute()` during the same tick when the attribute hasn't been applied yet. The `AttributePart` also sets `element.__manualKey` to provide a synchronous key for list diffing.

---

## Diffing strategy (high-level)

1. Build `oldMap` mapping current item keys → old values.
2. Iterate new array, compute key for each item, attempt to reuse old part or create a new part.
3. Keep track of `oldKeys` and clear any leftover parts at the end.
4. Reuse `ValuePart`s (or nested instances) when key matches to avoid full re-creation of DOM.

This keeps renders fast and predictable.

---

## Common pitfalls & debugging tips

* **Marker ordering**: if you see weird `<!--marker-->` strings being inserted into attributes, scoping or join/quote logic in `compile()` might be wrong — fix the `expectQuote` logic and ensure `"<!--marker-->"` is used only in the compile result.
* **Attribute timing**: `element.setAttribute()` is synchronous, but if you depend on attribute->value transformations (e.g., HTML parsing) or external frameworks reading attributes, prefer `__manualKey`.
* **Always apply attributes first**: if your list logic depends on attribute-derived keys, ensure attributes are applied before comment parts. (We do this by ordering parts or delaying comment part updates.)
* **Nested templates**: if nested item template contains its own dynamic parts, the nested `TemplateInstance` must be created via `helpers.createTemplateInstance` so it has its own parts list and update method.
* **Testing**: add console logs for `getDescriptors`, the `parts` array, and each part's `apply` to inspect the ordering and values array.

---

## Related docs

* `docs/html/README.md` — `html` tagged-template behavior, markers, caching, and `getValues()`
* `docs/custom-element.md` — `CustomElement` usage, decorators and lifecycle
* `docs/parts.md` — (detailed) per-part API & examples
* `docs/decorators/README.md` — `@property`, `@query`, `@debounce`, `@bind`
* `docs/functions/debounceFn.md` — debounceFn implementation and examples

---

## Example debug checklist (when list behaves strangely)

1. Log `getDescriptors(root)` to ensure descriptors list order is `attr/event` first, then `value/list` markers.
2. Log `values` retrieved from the clone (`getValues(newRoot)`).
3. Log each part on creation — confirm AttributePart runs before Comment/ListPart.
4. Confirm `key` resolution: test a template with `key=${i}` vs `key` not present.
5. If you still get placeholder markers inside attributes, inspect `compile()` output string.
