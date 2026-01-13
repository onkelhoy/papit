# `CumulativeOffset` — Element Position Calculator

> File: `docs/functions/CumulativeOffset.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

`CumulativeOffset` calculates the **total offset** of an HTML element relative to the document’s top-left corner.
It works by summing all `offsetTop` and `offsetLeft` values from the element up through its offset parents.

Useful when you need the absolute position of an element for tasks like:

* Positioning overlays or tooltips
* Aligning canvas drawings with DOM elements
* Calculating scroll offsets

---

## Signature

```ts
function CumulativeOffset(element: HTMLElement): { top: number; left: number };
```

---

## Parameters

| Name      | Type          | Description                                     |
| --------- | ------------- | ----------------------------------------------- |
| `element` | `HTMLElement` | The starting element to calculate offsets from. |

---

## Returns

An object containing:

| Property | Type     | Description                        |
| -------- | -------- | ---------------------------------- |
| `top`    | `number` | Total vertical offset in pixels.   |
| `left`   | `number` | Total horizontal offset in pixels. |

---

## Example

```ts
import { CumulativeOffset } from "@papit/web-component";

const el = document.querySelector("#my-element") as HTMLElement;
const { top, left } = CumulativeOffset(el);

console.log(`Element is at ${top}px from top and ${left}px from left of document.`);
```

---

## Behaviour

1. Starts from the given `element`.
2. Adds `offsetTop` and `offsetLeft` to running totals.
3. Moves to the `offsetParent` and repeats until there are no more parents.

---

## Under the Hood

```ts
export function CumulativeOffset(element: HTMLElement) {
  let top = 0, left = 0;
  do {
    top += element.offsetTop || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent as HTMLElement;
  } while (element);

  return { top, left };
}
```

---

## Gotchas & Notes

* **Does not account for transforms** — CSS transforms (e.g., `translate`) won’t be reflected.
* **Scroll offsets** — This function does not subtract scroll positions; for viewport-relative positions, use `getBoundingClientRect()`.
* If you need high-frequency calls, consider caching results for performance.

---

## Related

* [`Element.offsetTop` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetTop)
* [`getBoundingClientRect()` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)