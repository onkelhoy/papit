# CustomElement Base Class

> File: `docs/custom-element.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-11

---

## Introduction

The `CustomElement` base class in `@papit/web-component` provides:

* A **declarative rendering system** using the [`html`](./html/README.md) tagged template.
* **Efficient DOM updates** via `TemplateInstance` and the [parts system](./parts.md).
* Integration with **decorators** (`@property`, `@query`, `@bind`, `@debounce`).
* Built-in **debounced updates** to avoid unnecessary re-rendering.
* Standardized lifecycle handling for custom elements.

This base class is intended for **composition** — you extend it to create your own elements with minimal boilerplate.

---

## 1. Class Structure

```ts
export class CustomElement extends HTMLElement {
  static observedAttributes = [];

  get root(): HTMLElement | ShadowRoot { ... }

  constructor(shadowRootInit?: ShadowRootInit & Partial<Setting>) { ... }

  connectedCallback() { ... }
  disconnectedCallback() { ... }
  attributeChangedCallback(name, oldValue, newValue) { ... }

  firstRender() {}
  update() { ... }
  requestUpdate() {}

  querySelector<T extends Element>(selectors: string) { ... }
  querySelectorAll<T extends Element>(selectors: string) { ... }

  render(): string | Element { ... }

  private findQueries() { ... }
}
```

---

## 2. Rendering Pipeline

The `CustomElement` rendering cycle works like this:

1. **Construction**

   * Merges default settings with any provided `shadowRootInit`.
   * Calls `attachShadow(settings)` if shadow DOM is used.
   * Wraps `update()` with `debounceFn()` and assigns it to `requestUpdate()`.

2. **Connection**

   * `connectedCallback()` → triggers the **first render** by calling `update()`.

3. **Update**

   * Calls `this.render()` → returns either:

     * **String** → converted to a DOM fragment via [`html()`](./html/README.md).
     * **Element** → used directly.
   * If no `TemplateInstance` exists:

     * Appends the rendered DOM to `root`.
     * Creates a new `TemplateInstance` bound to the rendered DOM.
     * Calls `firstRender()` and dispatches `first-render` event.
   * Calls `TemplateInstance.update(values)` to patch DOM parts.
   * Calls `findQueries()` to resolve `@query` decorators.

4. **Subsequent Updates**

   * Call `this.requestUpdate()` to schedule a re-render (debounced).
   * The `TemplateInstance` updates only changed values — **no full re-render**.

---

## 3. Lifecycle Hooks

* **`connectedCallback()`** → Called when element is added to DOM.
* **`disconnectedCallback()`** → Called when element is removed.
* **`attributeChangedCallback(name, old, new)`** → Syncs observed attributes to decorated properties.
* **`firstRender()`** → Hook for initial setup (e.g., event listeners, style injection).
* **`update()`** → Renders or updates DOM.
* **`requestUpdate()`** → Schedules debounced update.

---

## 4. Styling

`CustomElement` supports built-in styling via two optional **static** properties:

```ts
static style: string;
static styles: string[];
```

These are automatically injected into a `<style>` tag inside the component’s render root after the first render.

**How it works**

* On the initial render, `firstRender()` calls `renderStyle()`
* `renderStyle()` merges `static styles` and `static style` into one CSS string via `getStyle()`
* This CSS is applied to the component’s root (`ShadowRoot` by default)

**Merge order**

1. All entries from `static styles` (array)
2. `static style` (string), appended last

```ts
class MyStyledElement extends CustomElement {
  static style = `:host { display: block; }`;
  static styles = [
    `:host { padding: 0.5rem; }`,
    `button { background: coral; color: white; }`
  ];

  render() {
    return html`<button>Click me</button>`;
  }
}
```

**Notes**

* Always call `super.firstRender()` if you override it, to ensure styles are applied.
* You can update styles dynamically by changing the static properties and calling `renderStyle()` again.
* Styles are scoped to the Shadow DOM unless shadow DOM is disabled.

---

## 5. Decorators Integration

The base class supports:

* **`@property`** → Syncs attributes ↔ properties.
* **`@query`** → Auto-queries DOM after each render.
* **`@bind`** → Auto-binds methods to the instance.
* **`@debounce`** → Debounces method calls.

Example:

```ts
class CounterElement extends CustomElement {
  @property({ type: Number }) count = 0;
  @query("#output") output!: HTMLElement;
  @bind increment() {
    this.count++;
    this.requestUpdate();
  }
  @debounce(300) logChange() {
    console.log("Count changed:", this.count);
  }

  render() {
    return html`
      <button @click=${this.increment}>+</button>
      <span id="output">${this.count}</span>
    `;
  }

  update() {
    super.update();
    this.logChange();
  }
}
```

---

## 6. Debounced Updates

By default, `requestUpdate()` is debounced with `STANDARD_DELAY` (50 ms) unless overridden:

```ts
new MyElement({ requestUpdateTimeout: 200 });
```

This avoids unnecessary reflows when multiple changes happen quickly.

---

## 7. Query Resolution

After each render, `findQueries()`:

* Iterates over `this.queryMeta`
* For each entry:

  * Runs `root.querySelector(meta.selector)`
  * Assigns the found element to the decorated property
  * Calls `meta.load(elm)` if provided

---

## 8. Extending `CustomElement`

Minimal:

```ts
class HelloWorld extends CustomElement {
  render() {
    return html`<p>Hello, world!</p>`;
  }
}
customElements.define("hello-world", HelloWorld);
```

With properties:

```ts
class Greeting extends CustomElement {
  @property({ type: String }) name = "Friend";
  render() {
    return html`<p>Hello, ${this.name}!</p>`;
  }
}
customElements.define("x-greeting", Greeting);
```

---

## 9. Related Links

* [HTML Tagged Templates](./html/README.md)
* [Parts System](./parts.md)
* [Decorators](./decorators/README.md)
* [Advanced Rendering Internals](./advanced.md)
* [CustomElementInternals](./custom-element-internals.md) — Extended base class with `ElementInternals` for form-associated elements.
