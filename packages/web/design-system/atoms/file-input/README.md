# @papit/file-input

An elegant solution to file input — fully featured with drag-and-drop, file indicator, upload progress, and form association.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-atoms-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/file-input.svg?logo=npm)](https://www.npmjs.com/package/@papit/file-input)

---

## Installation

```bash
npm install @papit/file-input
```

### HTML

```html
<script type="module" defer>
  import "@papit/file-input";
</script>

<pap-file-input></pap-file-input>
```

### JavaScript / TypeScript

```ts
import "@papit/file-input";
```

---

## Usage

### Basic

```html
<pap-file-input></pap-file-input>
```

### With indicator (shows selected files)

```html
<pap-file-input indicator></pap-file-input>
```

### Dropzone

```html
<pap-file-input dropzone indicator></pap-file-input>
```

### Multiple files

```html
<pap-file-input multiple indicator></pap-file-input>
```

### Restrict accepted file types

```html
<pap-file-input accept="image/*,.pdf"></pap-file-input>
```

Custom accept text via slot:

```html
<pap-file-input accept="image/*" dropzone>
  <span slot="accept">PNG, JPG, GIF up to 10MB</span>
</pap-file-input>
```

### Upload on demand

```html
<pap-file-input id="fi" uploadurl="/api/upload" indicator></pap-file-input>
<button onclick="document.getElementById('fi').upload()">Submit</button>
```

---

## Properties

| Property       | Attribute      | Type              | Default     | Description                                                                                   |
| -------------- | -------------- | ----------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `multiple`     | `multiple`     | `boolean`         | `false`     | Allow selecting multiple files. When `true`, upload sends all files in a single batch request |
| `accept`       | `accept`       | `string`          | `""`        | Accepted file types, passed directly to the native input (e.g. `image/*`, `.pdf`)             |
| `dropzone`     | `dropzone`     | `boolean`         | `false`     | Renders a drag-and-drop zone                                                                  |
| `indicator`    | `indicator`    | `boolean`         | `false`     | Renders the list of selected files with name, size, delete, and upload progress               |
| `name`         | `name`         | `string`          | `"file"`    | Field name used in FormData for both form submission and upload requests                      |
| `uploadurl`    | `uploadurl`    | `string`          | `undefined` | Endpoint URL for `upload()`. Required for upload to work                                      |
| `uploadmethod` | `uploadmethod` | `"post" \| "put"` | `"POST"`    | HTTP method used by `upload()`                                                                |

---

## Methods

### `upload(): Promise<void>`

Triggers file upload to `uploadurl`.

- When `multiple` is `false`: sends one XHR per file in parallel, each with individual progress tracking
- When `multiple` is `true`: sends all files in a single batched request; progress is shared across all files

```ts
const fi = document.querySelector("pap-file-input");
await fi.upload();
```

Throws if any individual upload fails. For batch, rejects on non-2xx status.

### `files` (getter)

Returns the currently selected `File[]` array.

```ts
const files = fi.files; // File[]
```

---

## Events

| Event    | Detail              | Description                                  |
| -------- | ------------------- | -------------------------------------------- |
| `change` | —                   | Fired when files are added or removed        |
| `upload` | `{ total: number }` | Fired when all uploads complete successfully |

```ts
fi.addEventListener("change", () => {
  console.log(fi.files);
});

fi.addEventListener("upload", (e) => {
  console.log(`Uploaded ${e.detail.total} files`);
});
```

---

## CSS Parts

| Part        | Element        | Description                                                     |
| ----------- | -------------- | --------------------------------------------------------------- |
| `label`     | `<label>`      | Outer label wrapping the button and dropzone content            |
| `dropzone`  | `<div>`        | The drag-and-drop content area (visible when `dropzone` is set) |
| `accept`    | `<p>`          | The accepted file types hint text                               |
| `button`    | `<pap-button>` | The "Upload" trigger button                                     |
| `input`     | `<input>`      | The hidden native file input                                    |
| `indicator` | `<section>`    | The file list container                                         |
| `file-link` | `<a>`          | Each file's anchor link in the indicator                        |

### CSS States

| State              | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `:state(dragging)` | Applied to `:host` while files are being dragged over the dropzone |

```css
pap-file-input::part(dropzone) {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
}

pap-file-input:state(dragging)::part(dropzone) {
  border-color: blue;
  background: #e8f0ff;
}
```

---

## Slots

| Slot     | Description                                                        |
| -------- | ------------------------------------------------------------------ |
| `accept` | Override the default accepted file types hint text in the dropzone |

---

## Form Association

`pap-file-input` is a form-associated custom element. It works inside `<form>` like a native `<input type="file">`:

```html
<form>
  <pap-file-input name="attachments" multiple></pap-file-input>
  <button type="submit">Submit</button>
</form>
```

The `name` attribute controls the FormData field name. Multiple files are appended under the same key (standard multipart behaviour).

---

## Accessibility (WCAG)

- Label is associated with the input via `for`/`id`
- File indicator uses `aria-live="polite"` — additions and deletions are announced to screen readers
- Delete buttons carry `aria-label="delete {filename}"` for unambiguous identification
- File links include `aria-label` noting the file opens in a new tab
- Drag-and-drop is supplementary — file selection via button is always available as a keyboard-accessible alternative
- `:state(dragging)` is CSS-only and does not affect keyboard users

---

## Contributing

Contributions are welcome. Please follow the development guidelines and ensure all tests pass before submitting a pull request.

## License

Licensed under the @Papit License 1.0 — Copyright (c) 2024 Henry Pap (@onkelhoy)

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

## Related

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/system/core): Core base class, decorators, and utilities
- [@papit/button](https://github.com/onkelhoy/papit/tree/main/packages/atoms/button): Button component used internally
- [@papit/icon](https://github.com/onkelhoy/papit/tree/main/packages/atoms/icon): Icon component used internally

## Support

For issues, questions, or contributions visit the [GitHub repository](https://github.com/onkelhoy/papit).
