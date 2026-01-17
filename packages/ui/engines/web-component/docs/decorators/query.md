# `@query` decorator

Caches and returns DOM elements (or node lists) from within a custom element’s shadow DOM or light DOM.  
It performs the query lazily (on first access) and stores the result for future calls, avoiding repeated DOM lookups.

> File: `docs/decorators/query.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Quick start

```ts
import { query } from "@papit/web-component";

class MyEl extends HTMLElement {
  @query('button.submit')
  submitButton!: HTMLButtonElement;

  connectedCallback() {
    console.log(this.submitButton); // <button class="submit">...</button>
  }
}
````

* The first time `this.submitButton` is accessed, the decorator queries for `button.submit` inside the element’s shadow DOM (or light DOM if no shadow root) and caches it.
* All subsequent calls return the cached reference.

---

## API

### Signature

```ts
query(selector: string, all?: boolean): any
```

### Parameters

| Parameter  |      Type | Default | Description                                                                                    |
| ---------- | --------: | ------- | ---------------------------------------------------------------------------------------------- |
| `selector` |  `string` | —       | CSS selector used for the query.                                                               |
| `all`      | `boolean` | `false` | When `true`, returns an array of all matching elements; when `false`, returns the first match. |

### Return value

* If `all` is `false` → single `Element` or `null`.
* If `all` is `true` → `Element[]` (may be empty).

---

## Behavior

* Looks up the element’s `renderRoot` property if present (typical for web components with shadow DOM).
  Falls back to `this` (light DOM) if `renderRoot` is undefined.
* On first access:

  * Performs `querySelector` or `querySelectorAll` depending on `all`.
  * If `all` is `true`, converts the `NodeList` to an array.
  * Stores the result in a hidden property named `__<propertyName>` on the instance.
* On subsequent access:

  * Returns the cached value without running the query again.
* You can manually clear the cache by deleting the hidden property:

  ```ts
  delete this.__submitButton;
  ```

---

## Examples

**Single element**

```ts
@query('input[type="text"]')
inputEl!: HTMLInputElement;

someMethod() {
  this.inputEl.focus();
}
```

**Multiple elements**

```ts
@query('.item', true)
items!: HTMLElement[];

renderItems() {
  this.items.forEach(item => item.classList.add('highlight'));
}
```

**Shadow DOM example**

```ts
class MyShadowEl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.innerHTML = `<button>Click</button>`;
  }

  @query('button')
  btn!: HTMLButtonElement;
}
```

If `renderRoot` exists, the decorator queries inside it — so in the example above it looks inside `shadowRoot`.

---

## Internals

The implementation is short but efficient:

```ts
export function query(selector: string, all: boolean = false) {
  return (target: any, propertyKey: string) => {
    const privateKey = `__${propertyKey}`;
    Object.defineProperty(target, propertyKey, {
      get() {
        if (!this[privateKey]) {
          const root = this.renderRoot ?? this;
          this[privateKey] = all
            ? Array.from(root.querySelectorAll(selector))
            : root.querySelector(selector);
        }
        return this[privateKey];
      },
      enumerable: true,
      configurable: true
    });
  };
}
```

* Uses `Object.defineProperty` to create a getter.
* Private cache uses `__<propertyKey>`.
* Checks `this.renderRoot` to support shadow DOM patterns.
* Uses `Array.from` to make sure a NodeList is turned into a real array for `all: true`.

---

## Edge cases & notes

* **Dynamic DOM changes**: Because the decorator caches results, newly added matching elements won’t be found unless you manually clear the cache (`delete this.__propName`).
* **Shadow DOM vs light DOM**: If you use `renderRoot` in your base class, the decorator automatically respects it; otherwise it queries the element itself.
* **Multiple matches with `all=false`**: Only the first match is returned; if you need multiple elements, set `all: true`.
* **Performance**: Ideal for static or rarely-changing DOM structures where repeated `querySelector` calls would be wasteful.

---

## Related docs

* [CustomElement](../custom-element.md)

---
