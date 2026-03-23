# @papit/icon

Renders SVG icons either by referencing a <symbol> in an existing spritesheet or by fetching an SVG from a URL. If the spritesheet is not yet present in the DOM, it fetches the SVG and injects it into the document body for reuse via symbol references.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-foundations-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/icon.svg?logo=npm)](https://www.npmjs.com/package/@papit/icon)

---

## installation

```bash
npm install @papit/icon
```

### to use in **html**

```html
<script type="module" defer>
  import "@papit/icon";
</script>

<pap-icon></pap-icon>
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

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
