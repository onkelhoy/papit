# @papit/translator

Translation store for papit components and apps. Register languages inline or by URL, fetch them lazily on first use, and translate keys with variable interpolation. Components re-render when the language changes.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-tools-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/translator.svg?logo=npm)](https://www.npmjs.com/package/@papit/translator)

---

# Installation

```bash
npm install @papit/translator
```

---

# Usage

```javascript
import { translator, useTranslator } from "@papit/translator";

translator.add({ id: "en", translations: { greeting: "Hello {name}" } });
translator.add({ id: "sv", url: "/translations/sv.json" }); // fetched on first change

await translator.change("en");

const t = useTranslator();
t("greeting", { name: "Ada" }); // "Hello Ada"
t("missing.key");               // "missing.key"
```

## Nested keys and scopes

Translation files can nest objects; dots in a key walk into them. A scope prefixes every key:

```json
{ "pap-sidebar": { "toggle": "Toggle sidebar" } }
```

```javascript
const t = useTranslator("pap-sidebar");
t("toggle"); // "Toggle sidebar"
```

## In a component

```ts
import { CustomElement, html } from "@papit/web-component";
import { translate, useTranslator } from "@papit/translator";

class MyElement extends CustomElement {
    @translate t = useTranslator("my-element");

    render() {
        return html`<button>${this.t("close")}</button>`;
    }
}
```

## Entry points

| Import | For |
| ------ | --- |
| `@papit/translator` | Browser (same as `/browser`) |
| `@papit/translator/browser` | Browser, includes the `@translate` decorator |
| `@papit/translator/node` | Node. No decorator, and `useTranslator` returns `{ translate, t }` |

---

# API

## translator

```ts
const translator: {
    add(entry: LanguageJson): void;
    change(entry: string | LanguageJson): Promise<LanguageJson | null>;
    subscribe(fn: () => void): () => void;
    list(): LanguageJson[];
    current(): LanguageJson | null;
    locale(): string | null;
}
```

The shared store. `list`, `current` and `locale` are `@papit/signals` readers, so reading them in an `effect` tracks them.

| Member | Description |
| ------ | ----------- |
| `add(entry)` | Registers a language. Ignored if the `id` is already registered |
| `change(entry)` | Makes a language current, by `id` or entry. Fetches its `url` the first time. Resolves `null` if the `id` is unknown or the fetch fails |
| `subscribe(fn)` | Calls `fn` on every later change of language. Returns an unsubscribe function |
| `list()` | Registered languages |
| `current()` | The current language, or `null` |
| `locale()` | `meta.language` of the current language, or `null` |

## useTranslator

```ts
function useTranslator(scope?: string): (key: string, variables?: Record<string, unknown>) => string
```

Returns a translate function that always uses the current language.

- A missing key, or no current language, returns the key.
- `{name}` is replaced by `variables.name`. Unknown placeholders are left as they are.
- Variable values: strings, numbers, booleans and bigints as text; dates as ISO strings; arrays joined with commas; functions are called; other objects as JSON.

## translate

```ts
@translate
@translate({ update?: (this: Element) => void })
```

Browser only. A field decorator for components: subscribes on `connectedCallback`, unsubscribes on `disconnectedCallback`, and calls `requestUpdate()` on each language change. `update` also runs on each change, and on connect when a language is already set.

## Types

```ts
type LanguageJson = {
    id: string;
    meta?: { language: string; region: string };
    url?: string;                           // fetched on first change
    translations?: Record<string, unknown>; // required when there's no url
}
```

Simplified: the declared type of `translations` is `Record<string, string>`, though nested objects work at runtime. `meta` can also sit inside the translations object or JSON file. The translate function's type is exported as `TransalatorFn`.

---

# License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

# Related Components

- [@papit/signals](https://github.com/onkelhoy/papit/tree/main/packages/web/tools/signals)
  The reactive state the translator is built on.
- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  The engine `@translate` components extend.
