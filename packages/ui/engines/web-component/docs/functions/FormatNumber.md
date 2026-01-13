# `FormatNumber` — Human-readable Number Formatting

> File: `docs/functions/FormatNumber.md`
> Author: Henry Pap (GitHub: @onkelhoy)
> Created: 2025-08-13

## Overview

`FormatNumber` converts large numbers into **human-readable strings** using suffixes like `k`, `m`, `bn`, and `tn`.
It supports localization via `Intl.NumberFormat`, allowing proper decimal separators and digit grouping for different locales.

Useful for dashboards, analytics UIs, and anywhere space-saving number displays are needed.

---

## Signature

```ts
function FormatNumber(num: number, formatter?: Intl.NumberFormat): string;
```

---

## Parameters

| Name        | Type                | Default      | Description                                                 |
| ----------- | ------------------- | ------------ | ----------------------------------------------------------- |
| `num`       | `number`            | **required** | The number to format.                                       |
| `formatter` | `Intl.NumberFormat` | `undefined`  | Optional formatter instance to localize decimal separators. |

---

## Returns

A string representation of the number with an appropriate suffix:

* **No suffix** for values `< 1,000`.
* **`k`** for thousands.
* **`m`** for millions.
* **`bn`** for billions.
* **`tn`** for trillions.

---

## Examples

```ts
FormatNumber(999);        // → "999"
FormatNumber(1500);       // → "1.5k"
FormatNumber(2_300_000);  // → "2.3m"

const svFormatter = new Intl.NumberFormat("sv-SE");
FormatNumber(1_500, svFormatter); // → "1,5k"
```

---

## Behaviour

1. Chooses suffix based on magnitude of the absolute number.
2. Divides and rounds to **one decimal place** (via multiplication/division by `10`).
3. Uses the provided `Intl.NumberFormat` if available; otherwise defaults to a raw number-to-string conversion.

---

## Under the Hood

```ts
export function FormatNumber(num: number, formatter?: Intl.NumberFormat) {
  const absNum = Math.abs(num);
  const fmt = formatter ?? new Intl.NumberFormat();

  if (absNum < 1_000) {
    return fmt.format(num);
  } else if (absNum < 1_000_000) {
    return fmt.format(Math.round((num * 10) / 1_000) / 10) + 'k';
  } else if (absNum < 1_000_000_000) {
    return fmt.format(Math.round((num * 10) / 1_000_000) / 10) + 'm';
  } else if (absNum < 1_000_000_000_000) {
    return fmt.format(Math.round((num * 10) / 1_000_000_000) / 10) + 'bn';
  } else {
    return fmt.format(Math.round((num * 10) / 1_000_000_000_000) / 10) + 'tn';
  }
}
```

---

## Gotchas & Notes

* Always **rounds to 1 decimal place** — for more precision, adjust the rounding logic.
* Suffixes are **hardcoded in English** — for localized suffixes, replace them based on the user’s locale.
* This function creates a new `Intl.NumberFormat` if one isn’t provided — for performance-sensitive loops, pass in a pre-created formatter.

---

## Related

* [`Intl.NumberFormat` on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — built-in localization API.
* [`formatCompact`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format) — an alternative approach using `notation: "compact"`.