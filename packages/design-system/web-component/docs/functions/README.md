# Functions — @papit/web-component

Utility functions that can be used independently from decorators or components.

---

## Available Functions

- [debounceFn](./debounceFn.md) — Creates a debounced version of a function to control execution frequency.
- [FormatNumber](./FormatNumber.md) — Formats numbers into compact, human-readable strings using locale rules.
- [ExtractSlotValue](./ExtractSlotValue.md) — Recursively extracts non-empty text content from a `<slot>` element.
- [lerp & lerpValue](./lerp.md) — Linearly interpolate values or remap a value from one range to another.
- [generateUUID](./generateUUID.md) — Generates a random RFC4122 version 4 UUID.
- [CumulativeOffset](./CumulativeOffset.md) — Calculates the cumulative top/left offset of an element relative to the document.
- [nextParent](./nextParent.md) — Finds the closest parent element or shadow host of a given element.

---

## Notes

- All functions are **pure** unless inherently tied to the DOM.
- Can be used in **any** JavaScript/TypeScript environment.
- For decorator-based equivalents, see the [Decorators](../decorators/README.md) section.
