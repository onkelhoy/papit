# `lerp` & `lerpValue` — Math Utilities

> File: `docs/functions/lerp.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

These functions provide **linear interpolation** utilities for mapping values within a range.

* **`lerp`** (Linear Interpolation): Computes a value between `a` and `b` given a normalized parameter `t` in `[0, 1]`.
* **`lerpValue`**: Maps a value from one range `[min, max]` to another range `[newmin, newmax]`, clamping the result to stay within the new range.

---

## Signatures

```ts
function lerp(a: number, b: number, t: number): number;

function lerpValue(
  value: number,
  min: number,
  max: number,
  newmin: number,
  newmax: number
): number;
```

---

## Parameters

### `lerp`

| Name | Type     | Description                                |
| ---- | -------- | ------------------------------------------ |
| `a`  | `number` | Start value.                               |
| `b`  | `number` | End value.                                 |
| `t`  | `number` | Interpolation factor (0 = start, 1 = end). |

### `lerpValue`

| Name     | Type     | Description                                     |
| -------- | -------- | ----------------------------------------------- |
| `value`  | `number` | The input value to map from the original range. |
| `min`    | `number` | Minimum value of the original range.            |
| `max`    | `number` | Maximum value of the original range.            |
| `newmin` | `number` | Minimum value of the target range.              |
| `newmax` | `number` | Maximum value of the target range.              |

---

## Returns

* **`lerp`**: A number between `a` and `b` according to the factor `t`.
* **`lerpValue`**: The mapped value in the `[newmin, newmax]` range, clamped.

---

## Examples

```ts
lerp(0, 10, 0.5); // → 5
lerp(10, 20, 0.25); // → 12.5

lerpValue(5, 0, 10, 0, 100); // → 50
lerpValue(15, 0, 10, 0, 100); // → 100 (clamped)
```

---

## Behaviour

1. **`lerp`**:

   * Formula: `a + (b - a) * t`.
   * Works for any numeric range (positive, negative, fractional).
2. **`lerpValue`**:

   * First normalizes `value` to `[0, 1]`.
   * Uses `lerp` to map to `[newmin, newmax]`.
   * Clamps output to avoid exceeding target range.

---

## Under the Hood

```ts
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpValue(
  value: number,
  min: number,
  max: number,
  newmin: number,
  newmax: number
) {
  const t = (value - min) / (max - min);
  return Math.min(newmax, Math.max(lerp(newmin, newmax, t), newmin));
}
```

---

## Gotchas & Notes

* `lerp` does **not** clamp `t` — passing `t < 0` or `t > 1` will extrapolate beyond `a` and `b`.
* `lerpValue` **does** clamp to `[newmin, newmax]`.
* Division by zero occurs if `min` equals `max` — ensure ranges are valid.

---

## Related

* [`Mathf.Lerp` in Unity Docs](https://docs.unity3d.com/ScriptReference/Mathf.Lerp.html)
* [`lerp` in GLSL](https://registry.khronos.org/OpenGL-Refpages/gl4/html/mix.xhtml) (`mix` function)