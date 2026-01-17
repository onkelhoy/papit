# `@debounce` — Method decorator

> File: `docs/decorators/debounce.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

## Overview

The `@debounce` decorator postpones execution of a method until a specified delay has elapsed since the last call.  
Useful for high-frequency events (e.g. `input`, `scroll`, `resize`) to avoid excessive processing.

This decorator is a thin wrapper over the standalone `debounceFn` utility. See: [debounceFn](../functions/debounceFn.md).

---

## Usage

```ts
import { debounce } from "@papit/web-component";

class SearchBox {
  // Replace the original method with a debounced version
  @debounce(300)
  onSearch(e: Event) {
    console.log("Search:", (e.target as HTMLInputElement).value);
  }
}
````

### Keep original method & add a named debounced version

If you want to keep the original method and add a debounced copy under a different name:

```ts
class Form {
  // Adds `submitDebounced` on the instance and leaves `submit()` intact
  @debounce({ delay: 400, name: "submitDebounced" })
  submit() {
    console.log("submit invoked");
  }
}

// usage
form.submit();           // immediate/original
form.submitDebounced();  // debounced version
```

---

## Overloads

You can call the decorator in several ways:

| Call form                    | Effect                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| `@debounce`                  | Use default delay (`STANDARD_DELAY`).                        |
| `@debounce(500)`             | Use custom delay (ms).                                       |
| `@debounce("customName")`    | Add debounced function under `"customName"` (default delay). |
| `@debounce({ delay, name })` | Full control — set delay and an alternate property name.     |

---

## How it works (brief)

1. Arguments are normalized into a `{ delay, name? }` options object.

   * number → `{ delay }`
   * string → `{ delay: STANDARD_DELAY, name }`
   * object → merged with defaults
2. A debounced wrapper is created using `debounceFn(original, delay)`.
3. If `name` is provided:

   * the decorator defines a new property on the prototype (or instance) with that name and assigns the debounced function to it. The original method is left unchanged.
4. If `name` is **not** provided:

   * the decorator replaces `descriptor.value` with the debounced function (so calling the method invokes the debounced version).

This design gives you the option to either replace the original method or keep it and expose a separate debounced variant.

---

## Example: multiple usages

```ts
class Demo {
  @debounce        // uses STANDARD_DELAY
  methodA() { ... }

  @debounce(250)   // 250ms
  methodB() { ... }

  @debounce("doLater") // doLater will be the debounced function, methodC untouched
  methodC() { ... }

  @debounce({ delay: 400, name: "deferredRun" })
  run() { ... }
}
```

---

## Gotchas & best practices

* **Arrow methods**: Decorators attach to the prototype. If you define a method as an arrow function on the instance (e.g. `method = () => {}`), decorators will not wrap that instance arrow. Use normal methods to benefit from the decorator.
* **Named version (`name`)**: Be careful not to shadow existing properties with the same name — the decorator will assign the debounced function to the provided `name`.
* **Per-instance timer**: The timer is per-instance (the debounced function uses instance-scoped state), so multiple instances don't share a single timer.
* **`this` binding**: The debounced wrapper calls the original method with the same `this`, so use normal methods to preserve `this`.
* **Cancelling**: The simple decorator does not expose cancel/flush APIs. If you need them, use `debounceFn` directly to build a richer wrapper.

---

## Implementation note

The decorator uses the shared `debounceFn` implementation so the core behaviour is centralised and testable:

```ts
// docs/functions/debounceFn.md
// See this file for the pure function that returns a debounced wrapper:

function debounceFn<T extends (...args: any[]) => any>(execute: T, delay = STANDARD_DELAY) { ... }
```

---

## Related

* [`debounceFn`](../functions/debounceFn.md)

