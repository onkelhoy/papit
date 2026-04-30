**`docs/decorators/context.md`**

````md
# `@context` — Property decorator

> File: `docs/decorators/context.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

## Overview

The `@context` decorator subscribes a property to a value provided by an ancestor element in the DOM tree. When the provider updates, the consumer automatically receives the new value and optionally re-renders.

Works with two kinds of providers:

- **Plain HTML elements** — value is read from an attribute and watched via `MutationObserver`.
- **Custom elements** — value is received via `context-{name}` events dispatched by `@property({ context: true })`.

---

## Usage

```ts
import { context, CustomElement, html } from "@papit/web-component";

class MyConsumer extends CustomElement {
  @context hello = "";

  render() {
    return html`<span>${this.hello}</span>`;
  }
}
customElements.define("my-consumer", MyConsumer);
```

### Plain element as provider

```html
<div hello="world">
  <my-consumer></my-consumer>
</div>
```

The consumer walks up the DOM, finds the `hello` attribute on the `<div>`, reads it immediately, and observes future `setAttribute` calls via `MutationObserver`.

### Custom element as provider

```ts
class MyProvider extends CustomElement {
  @property({ context: true }) hello = "world";

  render() {
    return html`<slot></slot>`;
  }
}
customElements.define("my-provider", MyProvider);
```

```html
<my-provider>
  <my-consumer></my-consumer>
</my-provider>
```

Every time `hello` changes on the provider, it dispatches a `context-hello` event. The consumer listens for that and updates itself.

---

## How it works (brief)

1. On `connectedCallback`, the consumer marks itself with a `{name}_subcontext` flag so nested consumers don't accidentally count as providers during the walk.
2. A `queueMicrotask` defers the parent walk one tick — this ensures CE providers have committed their class-field initializers before the consumer tries to read from them.
3. The walk traverses `nextParent()` until it finds an element that either has the property (CE) or the attribute (plain element), skipping any other consumers via the subcontext marker.
4. On finding a provider:
   - Calls `update()` immediately for the initial sync.
   - Subscribes to `context-{name}` and `context-manual-change` events (CE path).
   - Attaches a `MutationObserver` on the attribute (plain element path).
5. On `disconnectedCallback`, all listeners and the observer are torn down.

---

## Gotchas & best practices

- **Walk stops at `document.documentElement`**: if no provider is found, a warning is logged and the property keeps its class-field default.
- **Nested consumers**: safe — the `_subcontext` marker ensures the walk skips fellow consumers and reaches the real provider.
- **Disconnect/reconnect**: cleanup runs on disconnect; a fresh walk and subscription runs on reconnect.
- **Plain elements**: only `setAttribute` triggers an update — direct property mutation on a `<div>` will not be observed.
- **CE providers**: the property must use `@property({ context: true })` — that flag is what dispatches the `context-{name}` event on change.

---

## Related

- [`@property`](./property.md) — `context: true` option makes a property broadcast changes.
````
