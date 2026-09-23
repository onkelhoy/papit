---
name: papit-web-component
description: Internals of @papit/web-component (packages/web/engines/web-component), the from-scratch engine every papit web component extends. Covers CustomElement / CustomElementInternals lifecycle, the @property decorator and friends, the html`` template + part system and the constraints a change here must respect. Load for any engine work, and whenever a design-system bug might really be an engine bug.
---

# @papit/web-component

Load `papit-global` first. Detailed per-feature docs already exist in `packages/web/engines/web-component/docs/` (decorators, html, parts, custom-element). Read the relevant one before changing that area, and update it in the same branch.

## Why it matters
Every web package depends on it, so a change here is a change to all ~25 components. Treat it like a public framework: backwards compatible by default. Any breaking change is flagged to the architect and gets a `note:` in the merge message.

## Shape
```
src/element/     CustomElement (render/update lifecycle), CustomElementInternals (+ form association)
src/decorators/  property, bind, query, context, debounce, throttle
src/html/        html`` tagged template, unsafeHTML, part/ (attribute, event, value, list, nested parts, TemplateInstance)
src/functions/   small utilities (debounce, throttle, lerp, uuid, format-number, resolve, value parse/stringify, ...)
```
Everything is re-exported from `src/index.ts`. A new public thing is only public once exported there.

## Lifecycle (CustomElement)
- `constructor(settings?)` attaches an open shadow root (unless `lightDOM: true`) and creates the debounced `requestUpdate` (50 ms) and throttled `throttleUpdate`.
- `connectedCallback()` → `update()`. The first update calls `firstRender()`. Subclasses override `firstRender` and **must call `super.firstRender()`**, which adopts `static sheet` / `static sheets`.
- `render()` returns `html\`...\``, a string or a Node. Parts diff instead of replacing the DOM.
- `attributeChangedCallback` routes to the `@property` handlers (`propertyMeta`).
- `disconnectedCallback()` is empty by default. Subclasses that add listeners/observers in `connectedCallback` **must** remove them here.

`CustomElementInternals` adds `static formAssociated = true`, `this._internals` (ElementInternals), a reflected `disabled` property (`aria-disabled`), and the form callbacks (`formResetCallback`, `formDisabledCallback`, ...). Custom states go through `this._internals.states` and are styled with `:state(name)`.

## @property
```ts
@property({ type: Boolean, attribute: "defaultchecked", rerender: false,
            after(this: X, value, old, initial) { ... } })
defaultChecked?: boolean;
```
Key options (full list with docs in `decorators/property/types.ts`): `type` (coercion), `attribute` (name or false), `reflect`, `removeAttribute` (drop attr when falsy), `rerender`, `aria` (mirror to an aria attribute), `before`/`after(value, old, initial, attributeUpdate)`, `set`/`get`, `hasChanged`, `readonly`, `context`, `notify`.

Use `@bind` for event handler methods, `@query(selector)` for shadow refs resolved after render, and `@debounce`/`@throttle` for rate-limited methods.

## Hard constraints
- **No attribute writes during construction.** Class-field defaults run through the property setter. Reflecting them in the constructor makes `document.createElement(tag)` throw ("The result must not have attributes") and breaks every framework (React, Vue, Lit). Defer the reflection to `connectedCallback`. This is currently **broken** (see open bugs).
- **Zero runtime dependencies.**
- **Parsed HTML and `createElement` must both work.** Test both paths. Static fixture pages only exercise the parsed path.
- **No global side effects** at import except `customElements.define`, and that happens in each component's `index.ts`, never in the engine.

## Testing
Playwright suites live in `tests/decorators/` and `tests/html/`, each with its own `component.ts` test fixture element. Every suite should also cover `functions/` (pure, easy to cover), element lifecycle (first render, sheet adoption, requestUpdate debounce, disconnect cleanup), `createElement` path, `lightDOM` mode. See `papit-testing`.
