# @papit/svg-spritesheet

Merge multiple SVG files into a single SVG spritesheet using <symbol> elements.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-runtime-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/svg-spritesheet.svg?logo=npm)](https://www.npmjs.com/package/@papit/svg-spritesheet)

Here’s a **tight, minimal README**—npm-friendly and consistent with your other @papit packages:

---

# @papit/svg-spritesheet

Merge multiple SVG files into a single SVG spritesheet using `<symbol>` elements.

---

![Type](https://img.shields.io/badge/Type-runtime-orange)
[![NPM version](https://img.shields.io/npm/v/@papit/svg-spritesheet.svg?logo=npm)](https://www.npmjs.com/package/@papit/svg-spritesheet)

---

## Install

```bash
npm install @papit/svg-spritesheet
```

---

## Usage

```bash
svg-spritesheet --input ./icons --output ./spritesheet.svg
```

Defaults:

* **input**: current directory
* **output**: `<input>/spritesheet.svg`
* **symbol name**: `<title>` in SVG → fallback to filename

---

## Options

```text
--input <dir>        SVG directory
--output <file>     Output file
--name-query <sel>  Name selector (default: title)
--info              Show progress
```

---

## Output

```html
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="icon-name">…</symbol>
</svg>
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

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/onkelhoy/papit).
