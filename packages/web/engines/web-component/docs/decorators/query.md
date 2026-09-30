# `@query` decorator

Gives a property a reference to an element: one in the component's own shadow root, or, with `outside`, one around the component.

---

## Quick start

```ts
import { CustomElement, html, query } from "@papit/web-component";

class MyEl extends CustomElement {
    @query("button.submit") submitButton!: HTMLButtonElement;

    render() {
        return html`<button class="submit">Send</button>`;
    }
}
```

The reference is resolved after each render until it is found, then kept.

---

## API

```ts
@query                      // selector = the property name
@query(selector: string)
@query(settings: Partial<Setting>)
```

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `selector` | `string \| (this) => string` | property name | CSS selector. A function is called with the element as `this`, on every lookup |
| `outside` | `boolean` | `false` | Look outside the shadow root first, with [`findTarget`](../functions/findTarget.md) |
| `load(element)` | `function` | — | Runs when the element is found |
| `error()` | `function` | — | Runs after each render that still finds nothing |

---

## Behavior

- Runs after every `update()`, for each `@query` property that is still empty, so elements rendered later are picked up.
- Without `outside`, it searches the render root (`this.root`: the shadow root, or the element in light DOM mode).
- With `outside`, it uses `findTarget(this, selector)`: a single match in the element's root node is returned directly, otherwise the nearest matching ancestor (walking through shadow hosts). If that finds nothing it falls back to the render root.
- When a render is removed (`render()` returned nothing or a different template), the references into it are reset to `null` and looked up again. `outside` references are kept.

---

## Examples

**An element the component sits in, or one named by `aria-controls`**

```ts
@query<Carousel>({
    outside: true,
    selector(this: Next) {
        const id = this.getAttribute("aria-controls"); // an id, not a selector
        return id ? `#${CSS.escape(id)}` : "pap-carousel";
    },
}) carousel: Carousel | null = null;
```

**Reacting once it's there**

```ts
@query({
    selector: "input",
    load(this: MyField, input: HTMLInputElement) {
        input.value = this.value;
    },
}) input!: HTMLInputElement;
```

---

## Related docs

- [CustomElement](../custom-element.md)
- [findTarget](../functions/findTarget.md)
