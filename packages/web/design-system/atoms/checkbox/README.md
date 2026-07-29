# @papit/checkbox

a WCAG compliant checkbox component with indeterminate state

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/checkbox.svg?logo=npm)](https://www.npmjs.com/package/@papit/checkbox)

---

## installation

```bash
npm install @papit/checkbox
```

### to use in **html**

```html
<script type="module" defer>
  import "@papit/checkbox";
</script>

<pap-checkbox>Subscribe to newsletter</pap-checkbox>
```

## indeterminate state

Useful for "select all" controls representing a partial selection:

```html
<pap-checkbox id="select-all" indeterminate>Select all</pap-checkbox>
```

Activating an indeterminate checkbox (via click or Space) clears `indeterminate` and moves it to `checked`, per the [ARIA Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/).

## grouped selection (`aria-controls`)

A `pap-checkbox` can act as a "select all" for a set of other checkboxes — native `<input type="checkbox">` or other `pap-checkbox` elements — by pointing `aria-controls` at their IDs:

```html
<pap-checkbox aria-controls="cond1 cond2 cond3 cond4"
  >All condiments</pap-checkbox
>

<ul>
  <li><pap-checkbox id="cond1">Lettuce</pap-checkbox></li>
  <li><pap-checkbox id="cond2" checked>Tomato</pap-checkbox></li>
  <li><pap-checkbox id="cond3">Mustard</pap-checkbox></li>
  <li><pap-checkbox id="cond4">Sprouts</pap-checkbox></li>
</ul>
```

Behavior:

- **Toggling the group checkbox** (click, Space, or setting `.checked` programmatically) sets every controlled checkbox to match, and clears its own `indeterminate` if it was mixed.
- **Toggling any individual controlled checkbox** updates the group automatically:
  - none checked → group is unchecked
  - all checked → group is checked
  - some checked → group becomes `indeterminate` (`aria-checked="mixed"`)
- The group is never simultaneously `checked` and `indeterminate` — entering the mixed state always clears `checked` underneath, so a subsequent activation is a genuine transition rather than a no-op.
- Setting `indeterminate` directly (e.g. `checkbox.indeterminate = true`) only changes the group's own display state — it does **not** cascade to or alter the controlled checkboxes.

Controlled elements are resolved by ID from the same root as the group checkbox (document or shadow root), so this works whether the children are plain light-DOM elements or siblings inside the same shadow tree.

## forms

`pap-checkbox` is form-associated. Use `name` and `value` to submit its state, and `defaultchecked` to control what a `<form>` reset restores it to:

```html
<form>
  <pap-checkbox name="agree" value="yes">I agree</pap-checkbox>
  <button type="reset">Reset</button>
</form>
```

## disabled & readonly

- `disabled` removes the checkbox from the tab order (`tabindex` is dropped) and blocks all interaction, per the APG.
- `readonly` keeps the checkbox focusable and announced normally, but blocks state changes from click or Space — useful when you want the value visible and reachable but not editable.

```html
<pap-checkbox disabled>Can't touch this</pap-checkbox>
<pap-checkbox readonly checked>Visible, but locked</pap-checkbox>
```

## reference

| Attribute        | Type      | Description                                                                                         |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `checked`        | `boolean` | Current checked state. Reflects `aria-checked`.                                                     |
| `indeterminate`  | `boolean` | Puts the checkbox in the mixed state (`aria-checked="mixed"`); cleared automatically on activation. |
| `defaultchecked` | `boolean` | Checked state restored on form `reset`.                                                             |
| `disabled`       | `boolean` | Disables interaction and focusability.                                                              |
| `readonly`       | `boolean` | Prevents state changes while keeping focusable.                                                     |
| `name` / `value` | `string`  | Standard form submission fields.                                                                    |
| `aria-controls`  | `string`  | Space-separated IDs of checkboxes this one drives as a group.                                       |

| Event    | Fired when                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `change` | `checked` changes via user interaction or direct assignment (not when synced by a controlling group). |

| CSS Part | Description                                                    |
| -------- | -------------------------------------------------------------- |
| `marker` | The native `<input type="checkbox">` used for form submission. |

| CSS Custom Property | Default       | Description                                               |
| ------------------- | ------------- | --------------------------------------------------------- |
| `--accent`          | `AccentColor` | Outline color shown on keyboard focus (`:focus-visible`). |

> **Note:** the marker currently uses the browser's native checkbox appearance — there's no custom fill/sizing for the `checked`/`indeterminate` states yet, and the marker-to-label gap is present in the stylesheet but currently commented out (no gap renders between them today).

## Contributing

Contributions are welcome! Please follow the development guidelines above and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 - Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related Components

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core utilities, decorators, and base component class
- [@papit/radio](https://github.com/onkelhoy/papit/tree/main/packages/atoms/radio): Mutually-exclusive selection within a named group

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
