# `debounceFn` — Utility Function

> File: `docs/functions/debounceFn.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

## Overview

`debounceFn` is a standalone utility that creates a debounced version of any function.  
The returned function delays execution until after a specified wait time has passed since the last time it was called.

Useful when you want to limit the frequency of expensive operations (e.g., network requests, DOM updates) in response to high-frequency events.

---

## Signature

```ts
function debounceFn<T extends (...args: any[]) => any>(
  execute: T,
  delay?: number
): (...args: Parameters<T>) => void;
````

---

## Parameters

| Name      | Type           | Default          | Description                                                        |
| --------- | -------------- | ---------------- | ------------------------------------------------------------------ |
| `execute` | `T` (function) | **required**     | The function to debounce.                                          |
| `delay`   | `number`       | `STANDARD_DELAY` | Delay in milliseconds to wait after the last call before invoking. |

---

## Returns

A **new function** that:

* Shares the same parameters as `execute`.
* Resets its internal timer on every call.
* Calls `execute` only after `delay` ms have passed since the last call.
* Preserves `this` when called as a method.

---

## Example

```ts
import { debounceFn } from "@papit/web-component";
import { STANDARD_DELAY } from "@papit/web-component/constants";

function saveToServer(data: string) {
  console.log("Saving:", data);
}

const debouncedSave = debounceFn(saveToServer, 300);

// These rapid calls will result in a single execution after ~300ms:
debouncedSave("a");
debouncedSave("ab");
debouncedSave("abc");
```

---

## Behaviour

1. **Timer Resetting**
   Every time the returned function is called, it cancels any previously scheduled execution and schedules a new one.

2. **Preserved Context**
   The `this` value from the call site is passed through to the original function.

3. **One-shot Execution**
   Execution happens once after the latest delay period passes without a new call.

---

## Under the Hood

The implementation in `@papit/web-component` is:

```ts
export function debounceFn<T extends (...args: any[]) => any>(
  execute: T,
  delay: number = STANDARD_DELAY
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      execute.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

---

## Gotchas & Notes

* **No cancel/flush** — This minimal implementation doesn't expose `cancel()` or `flush()` methods. If you need these, you can wrap `debounceFn` to add them.
* **Garbage Collection** — Because the timer is stored in a closure, it won't leak memory as long as the debounced function itself isn't leaked.
* **Instance safety** — If used inside a class method, each instance needs its own debounced wrapper (use it in the constructor or via the `@debounce` decorator).

---

## Related

* [`@debounce`](../decorators/debounce.md) — method decorator using `debounceFn` under the hood.
