# `ExtractSlotValue` — DOM Utility Function

> File: `docs/functions/ExtractSlotValue.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

`ExtractSlotValue` retrieves all **text values** from the flattened DOM tree assigned to a given `<slot>` element.
It descends through all child nodes, skipping empty text, and returns an array of strings.

Useful for extracting raw textual content from slotted elements, regardless of nesting depth.

---

## Signature

```ts
function ExtractSlotValue(slot: HTMLSlotElement): string[];
```

---

## Parameters

| Name   | Type              | Default      | Description                                                    |
| ------ | ----------------- | ------------ | -------------------------------------------------------------- |
| `slot` | `HTMLSlotElement` | **required** | The `<slot>` element whose assigned content will be processed. |

---

## Returns

An array of **non-empty text strings** extracted from the slot's assigned nodes.
Whitespace-only text nodes are ignored.

---

## Example

```ts
// HTML
<my-component>
  <span slot="title">Hello</span>
  <span slot="title">World</span>
</my-component>

// Inside the component:
const slotEl = this.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="title"]')!;
console.log(ExtractSlotValue(slotEl));
// → ["Hello", "World"]
```

---

## Behaviour

1. Uses `slot.assignedNodes()` to get distributed nodes.
2. Recursively walks each node's children.
3. Pushes trimmed non-empty `textContent` values into the result array.

---

## Under the Hood

```ts
export function ExtractSlotValue(slot: HTMLSlotElement) {
  const nodes = slot.assignedNodes();

  const values: Array<string> = [];
  nodes.forEach(node => appendLeafValue(node, values));

  return values;
}

function appendLeafValue(node: Node, L: Array<string>) {
  if (node.hasChildNodes()) {
    node.childNodes.forEach(child => appendLeafValue(child, L));
  } else if (node.textContent) {
    if (node.textContent.trim() === "") return;
    L.push(node.textContent);
  }
}
```

---

## Gotchas & Notes

* Only extracts **text**, not HTML markup.
* Does not deduplicate — if two nodes have the same text, both will appear.
* Skips empty and whitespace-only nodes.

---

## Related

* [`HTMLSlotElement.assignedNodes()` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedNodes)
* Similar helper: `ExtractSlotNodes` — if you need actual nodes instead of text.
