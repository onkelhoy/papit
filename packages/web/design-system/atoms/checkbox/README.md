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

## forms

`pap-checkbox` is form-associated. Use `name` and `value` to submit its state, and `defaultchecked` to control what a `<form>` reset restores it to:

```html
<form>
  <pap-checkbox name="agree" value="yes">I agree</pap-checkbox>
  <button type="reset">Reset</button>
</form>
```

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
