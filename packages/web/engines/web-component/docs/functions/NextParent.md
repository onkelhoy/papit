# `nextParent` — Find Closest Parent Element or Host

> File: `docs/functions/nextParent.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

`nextParent` returns the **next parent container** of a given DOM element.
If the element is inside a regular DOM tree, it returns the `parentElement`.
If it’s inside a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM), it returns the **shadow host** instead.

Useful when navigating DOM relationships in components that may or may not be in Shadow DOM.

---

## Signature

```ts
function nextParent<T = HTMLElement>(element: HTMLElement): T | null;
```

---

## Type Parameters

| Name | Default       | Description                                |
| ---- | ------------- | ------------------------------------------ |
| `T`  | `HTMLElement` | Expected type of the returned parent/host. |

---

## Parameters

| Name      | Type          | Description                      |
| --------- | ------------- | -------------------------------- |
| `element` | `HTMLElement` | The element whose parent to find |

---

## Returns

- `T` — The immediate parent element or shadow host.
- `null` — If neither parent nor shadow host exists.

---

## Example

```ts
import { nextParent } from "@papit/web-component";

const child = document.querySelector("#child") as HTMLElement;
const parent = nextParent(child);

if (parent) {
  console.log("Found parent/host:", parent);
} else {
  console.log("No parent found");
}
```

---

## Behaviour

1. **Regular DOM**: Returns `element.parentElement` if available.
2. **Shadow DOM**: Uses `element.getRootNode()` to detect shadow root and returns its `.host`.
3. **No Parent**: Returns `null` if neither condition matches.

---

## Under the Hood

```ts
export function nextParent<T = HTMLElement>(element: HTMLElement) {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  if (root) return (root as any).host as T;
  return null;
}
```

---

## Gotchas & Notes

- **Type Safety** — You can pass a type parameter if you know the exact element type:

  ```ts
  const host = nextParent<HTMLButtonElement>(myElement);
  ```

- **Not recursive** — This only finds the immediate parent/host, not ancestors higher up the chain.
- Works in browsers that support `Shadow DOM` and `getRootNode()`.

---

## Related

- [`Node.parentElement` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Node/parentElement)
- [`ShadowRoot.host` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/host)
