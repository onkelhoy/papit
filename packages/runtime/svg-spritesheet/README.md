# @papit/svg-spritesheet

Command-line tool that merges a folder of SVG files into one SVG spritesheet, with one symbol per file named after its title or filename.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/svg-spritesheet.svg?logo=npm)](https://www.npmjs.com/package/@papit/svg-spritesheet)

---

# Installation

```bash
npm install -D @papit/svg-spritesheet
```

# Usage

```bash
npx @papit/svg-spritesheet --input ./icons --output ./asset/icons/spritesheet.svg --name-query title
```

Given `icons/check.svg` and `icons/arrow-left.svg`:

```html
<!-- icons/check.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>check</title><path d="…"/></svg>
<!-- icons/arrow-left.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="…"/></svg>
```

the spritesheet holds one symbol per file:

```html
<svg xmlns="http://www.w3.org/2000/svg">
    <symbol id="arrow-left" viewBox="0 0 16 16"><path d="…"></path></symbol>
    <symbol id="check" viewBox="0 0 24 24"><title>check</title><path d="…"></path></symbol>
</svg>
```

Reference an icon by its id:

```html
<svg><use href="/icons/spritesheet.svg#check"></use></svg>
```

# CLI flags

| Flag | Default | Description |
| --- | --- | --- |
| `--input` | current folder | folder with the `.svg` files (not recursive) |
| `--output` | `<input>/spritesheet.svg` | file to write, folders are created |
| `--name-query` | `title` | selector whose text becomes the symbol id |
| `--info` | - | print progress per file |

Right now `--output` and `--name-query` must be given; leaving either out throws instead of using the default.

# How files are merged

- Each root `<svg>` becomes a symbol. Its attributes (like `viewBox`) are copied over, except `xmlns`.
- The id is the text of the first `--name-query` match, falling back to the filename without `.svg`.
- A file that can't be parsed is skipped with a warning.
- An existing output file is replaced.

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

# Related

- [@papit/html](https://github.com/onkelhoy/papit/tree/main/packages/runtime/html) - the parser that reads and writes the SVG files
- [@papit/server](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/server) - builds its explorer icons with this
