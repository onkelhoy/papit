# `@property` decorator

Provides a convenient, declarative way to define reactive properties on `CustomElement` subclasses.

This decorator:
- defines a JS property with getter/setter that store the value on a private backing field,
- optionally mirrors the property to an HTML attribute (with type conversion),
- optionally causes the element to trigger a rerender when the property changes,
- supports lifecycle hooks (`before`, `after`) and read-only properties,
- keeps attribute ↔ property updates loop-safe (internal-update flag).

> File: `docs/decorators/property.md`  
> Author: Henry Pap (GitHub: @onkelhoy)  
> Created: 2025-08-11

---

## Quick start

```ts
import { property } from "@papit/web-component";

class MyEl extends HTMLElement {
  @property({ type: Number, attribute: "counter", rerender: true })
  count = 0;
}
````

* `count` will reflect to the `counter` attribute as a stringified number.
* When `count` changes (and `rerender: true`) it will call `requestUpdate()` on the instance (debounced in the core).

---

## API

### Signature / overloads

```ts
// Use as decorator without args
@property
prop: any;

// Use as decorator with options
@property({ type: Number, attribute: "count", rerender: true })
count: number;
```

### Options

| Option                        |                                  Type | Default         | Description                                                                                       |
| ----------------------------- | ------------------------------------: | --------------- | ------------------------------------------------------------------------------------------------- |
| `type`                        |                            `Function` | `String`        | Native constructor used for attribute parsing/serialization (String, Number, Boolean, or custom)  |
| `attribute`                   |                   `boolean \| string` | `false`         | If truthy, syncs property ↔ attribute. If string, that string is the attribute name.              |
| `readonly`                    |                             `boolean` | `false`         | When true, property may be set only once; reassignment throws.                                    |
| `rerender`                    |                             `boolean` | `false`         | When true, on non-initial changes the property will call `this.requestUpdate()` (if present).     |
| `removeAttribute`             |                             `boolean` | `true`          | When clearing a property (null/undefined/false) remove the attribute instead of setting a string. |
| `before`                      | `(newVal, oldVal, isInitial, isAttribute) => void` | —               | Hook called synchronously before the value is stored.                                             |
| `after`                       | `(newVal, oldVal, isInitial, isAttribute) => void` | —               | Hook called synchronously after the value is stored.                                              |
| `get` / `set`                 |                             functions | —               | You may provide getter/setter wrappers in options to customize access.                            |
| `configurable` / `enumerable` |                             `boolean` | `true` / `true` | Controls generated property descriptor flags.                                                     |
| `maxReqursiveSteps`           |                              `number` | `20`            | Controls how deeply the decorator's equality check will recurse for complex values.               |

---

## Behavior (detailed)

### Backing storage

The decorator stores the actual value on a private backing field named: `__<propertyName>`.

### Attribute reflection

* If `attribute` is enabled, the decorator will add the attribute name to the class's `observedAttributes` (so `attributeChangedCallback` is invoked).
* When the attribute changes (via `attributeChangedCallback`), the decorator parses the attribute value using `type` and assigns the property. An internal flag prevents the attribute write from re-triggering this setter (avoids loops).
* When the property is set, if `attribute` is enabled the decorator will reflect the value back to the attribute (or remove it when falsey, per `removeAttribute`).

### Type conversion

`type` controls parsing and serialization:

* `String` → `String(value)`
* `Number` → `Number(value)`
* `Boolean` → falsy strings (`false`, `0`, `f`, \`\`) map to `false`, otherwise `true`.
* Other types: JSON.parse / JSON.stringify is used as the default for objects. (For custom types you can supply `get`/`set` hooks.)

### Equality checking

The decorator uses a recursive `sameValue(a, b)` function to avoid updating when the property value hasn't meaningfully changed. It handles:

* primitive equality
* deeply compares arrays and objects up to `maxReqursiveSteps` depth
* throws if recursion too deep (safety)

If `sameValue` reports equal, the setter is a no-op (unless `internalUpdate` is active).

### Loop-safety (internalUpdate)

The decorator uses an `internalUpdate` boolean to avoid feedback loops between attribute ↔ property updates:

* When the attribute changes and the decorator sets the property, `internalUpdate` is temporarily set so the setter doesn't reflect back to the attribute.
* When the setter writes the attribute, `internalUpdate` prevents attribute logic from writing the property again.

### Hooks & lifecycle

* `before` is invoked before the value is stored (receives `(newVal, oldVal, isInitial, isAttribute)`).
* `after` is invoked after the value is stored (receives same args).
* `isInitial` indicates the initial assignment (true on first set).

### Read-only properties

If `readonly: true` and the backing property already exists, future assignments throw a `TypeError`.

### Request update

If `rerender: true` and the change is not the initial assignment, the decorator will call `this.requestUpdate()` (if present). The core uses a debounced `requestUpdate`.

---

## Examples

**Simple attribute reflection**

```ts
class MyCounter extends CustomElement {
  @property({ type: Number, attribute: 'count', rerender: true })
  count = 0;
}
```

**Readonly property**

```ts
class ConfigEl extends CustomElement {
  @property({ readonly: true })
  apiKey = 'abcd'; // cannot be reassigned later
}
```

**Complex object (JSON)**

```ts
class DataEl extends CustomElement {
  @property({ type: Object, rerender: true })
  data = { a: 1 };
}
```

> When `type` is non-primitive, the decorator serializes to JSON for attributes; parsing uses `JSON.parse`.

**Custom hooks**

```ts
@property({
  type: Number,
  before(newVal, oldVal, isInitial) {
    console.log('about to change', oldVal, '→', newVal);
  },
  after(newVal) {
    console.log('changed to', newVal);
  }
})
value = 0;
```

---

## Internals — how it integrates with the renderer

* The decorator registers attribute names on the class `observedAttributes`. The `CustomElement.attributeChangedCallback` looks up a property update handler stored in `this.propertyMeta` and invokes it when an attribute changes.
* The decorator stores a `PropertyMeta` mapping on the class instance prototype containing attribute → handler mappings. This allows the `attributeChangedCallback` to find the right property setter logic without hard-coding names.
* On `set`, the decorator optionally calls `requestUpdate()` when `rerender: true`. `requestUpdate` in the core is a debounced function that calls the component's `update()` which runs `render()` → `html()` to extract values and patch with `TemplateInstance`.

---

## Edge cases & gotchas

* **Complex cyclic objects**: `sameValue` does deep comparisons; if your data is deeply nested or self-referential you may hit `maxReqursiveSteps`. You can increase the limit, or implement a custom equality via a wrapper/getter.
* **Attribute timing**: setting attributes and immediately `getAttribute` in the same synchronous frame can be brittle; the decorator avoids depending on attribute reads to compute a key. If you need instant DOM-attribute reads after setting, use the property value (not `getAttribute`) where possible.
* **Manual attribute writes**: If user code calls `el.setAttribute('x', 'y')` directly, `attributeChangedCallback` will update the property. The decorator prevents cycles with `internalUpdate`.
* **Boolean attribute falsiness**: Many formats exist to represent false as strings — the implementation treats `false`, `f`, `0`, and `''` (case-insensitive) as false.

---

## Implementation notes (summary)

* The decorator uses `Object.defineProperty` to install a getter/setter.
* Private backing field: `__<propName>`.
* When `attribute` is enabled the attribute name is added to `constructor.observedAttributes`.
* PropertyMeta mapping is used so `attributeChangedCallback` maps attributes to property handlers without excessive coupling.
* `sameValue` used to avoid unnecessary DOM updates.
* Uses `internalUpdate` to keep attribute ↔ property sync loop-safe.

---

## Recommended patterns

* Use `type` for simple primitives (Number, Boolean, String). For complex objects prefer passing them as properties (not attributes) unless serialization is acceptable.
* Use `rerender: true` for properties that should cause UI updates. Keep heavy objects out of rerender triggers if frequent.
* Use `before` / `after` hooks for side effects (analytics, logging), but avoid expensive synchronous operations there.

---

## Related docs

* [Advanced](../advanced.md)
* [CustomElement](../custom-element.md)
