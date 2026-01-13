# `generateUUID` — RFC 4122 v4 UUID Generator

> File: `docs/functions/generateUUID.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

`generateUUID` creates a **universally unique identifier** (UUID) conforming to RFC 4122 version 4.
It uses a combination of the current timestamp, a high-resolution timer (`performance.now()`), and random values to ensure uniqueness.

UUIDs are useful for uniquely identifying objects, entities, or resources across systems and sessions.

---

## Signature

```ts
function generateUUID(): string;
```

---

## Parameters

This function takes **no parameters**.

---

## Returns

A string UUID in the form:

```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Where:

* `x` is a random hexadecimal digit.
* The `4` indicates UUID version 4.
* `y` is one of `8`, `9`, `A`, or `B` (UUID variant bits).

---

## Example

```ts
import { generateUUID } from "@papit/web-component";

const id1 = generateUUID(); // "f65c57f6-a6aa-4d5a-9f4d-7b7e3e6b1b0c"
const id2 = generateUUID(); // "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
```

---

## Behaviour

1. Gets the current timestamp in milliseconds.
2. Adds `performance.now()` if available for higher precision.
3. Uses `.replace(/[xy]/g, …)` to substitute each placeholder:

   * `x` is replaced with a random hex digit.
   * `y` is replaced with `(random & 0x3 | 0x8)` to set the correct variant bits.

---

## Under the Hood

```ts
export function generateUUID() {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); // Use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

---

## Gotchas & Notes

* **Not cryptographically secure** — for security-critical IDs, use `crypto.randomUUID()` or `crypto.getRandomValues()` instead.
* This implementation is **self-contained** and doesn’t require external libraries.
* Collision risk is negligible for most non-security use cases, but not mathematically impossible.

---

## Related

* [`crypto.randomUUID()` on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
* [`uuid` npm package](https://www.npmjs.com/package/uuid) — more robust UUID generation.