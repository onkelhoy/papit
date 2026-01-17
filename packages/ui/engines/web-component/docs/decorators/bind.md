# `@bind` decorator

Ensures that class methods always use the correct `this` context, even when passed as callbacks or event handlers.

> File: `docs/decorators/bind.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Quick start

```ts
import { bind } from "@papit/web-component";

class MyEl extends HTMLElement {
  @bind
  handleClick(event: MouseEvent) {
    console.log(this); // Always the instance of MyEl
  }

  connectedCallback() {
    this.addEventListener('click', this.handleClick);
  }
}
````

Without `@bind`, `this` inside `handleClick` could be `undefined` or refer to the wrong object when used as a callback.

---

## API

### Signature

```ts
bind<T>(
  target: Object,
  propertyKey: PropertyKey,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T>
```

### Parameters

| Parameter     | Type                         | Description                             |
| ------------- | ---------------------------- | --------------------------------------- |
| `target`      | `Object`                     | The prototype of the class.             |
| `propertyKey` | `PropertyKey`                | The name of the method being decorated. |
| `descriptor`  | `TypedPropertyDescriptor<T>` | The property descriptor for the method. |

### Return value

* Returns a modified descriptor where the getter binds the original method to the instance on first access.

---

## Behavior

* The first time the decorated method is accessed:

  1. The original function is bound to the instance (`this`).
  2. The bound function is **assigned directly** to the instance, replacing the getter for future calls.
* Subsequent accesses call the already-bound method without additional binding overhead.
* Avoids creating a new bound function for each call (better performance vs inline `this.method.bind(this)`).

---

## Examples

**Event listener without worries**

```ts
class MyButton extends HTMLElement {
  @bind
  onClick() {
    console.log(this instanceof MyButton); // true
  }

  connectedCallback() {
    this.addEventListener('click', this.onClick);
  }
}
```

**Using with async callbacks**

```ts
class MyAsyncEl extends HTMLElement {
  @bind
  async fetchData() {
    const data = await fetch('/api/data').then(r => r.json());
    console.log('Data for', this, ':', data);
  }

  connectedCallback() {
    setTimeout(this.fetchData, 1000);
  }
}
```

---

## Internals

Implementation:

```ts
export function bind<T>(
  target: Object,
  propertyKey: PropertyKey,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> {
  const original = descriptor.value as unknown as Function;
  return {
    configurable: true,
    get() {
      const boundFn = original.bind(this);
      Object.defineProperty(this, propertyKey, {
        value: boundFn,
        configurable: true,
        writable: true
      });
      return boundFn;
    }
  } as TypedPropertyDescriptor<T>;
}
```

* Grabs the original method from the descriptor.
* Defines a **getter** that:

  * Binds the method to the current instance.
  * Caches the bound method directly on the instance (no more getter calls next time).
* Uses `Object.defineProperty` so the method behaves like a normal property afterwards.

---

## Edge cases & notes

* Only works for **methods**, not properties or arrow functions defined in the constructor.
* If you override a bound method in a subclass, it will bind the new method instead.
* Binding happens **once per instance per method**, not per call — this is why it’s efficient.
* Ideal for:

  * Event listeners in web components
  * Methods passed to external libraries that lose context
  * Async callbacks where `this` should refer to the class instance

---

## Related docs

* [CustomElement](../custom-element.md)