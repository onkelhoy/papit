# @papit/lexer

Character-level state machine lexer: describe states and rules, get a token list back. Ships ready-made HTML, CSS and JavaScript tokenizers, and powers @papit/html.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/lexer.svg?logo=npm)](https://www.npmjs.com/package/@papit/lexer)

---

# Installation

```bash
npm install @papit/lexer
```

# Usage

Tokenize HTML:

```js
import { html } from "@papit/lexer";

html('<a href="/x" hidden>hi</a><br/>');
// [
//   { type: "startTag", name: "a", attributes: { href: "/x", hidden: true }, selfClosing: false },
//   { type: "text", value: "hi" },
//   { type: "endTag", name: "a" },
//   { type: "startTag", name: "br", attributes: {}, selfClosing: true },
// ]
```

CSS and JavaScript:

```js
import { css, js } from "@papit/lexer";

css("a:hover { color: red; }");
// selector "a:hover", braceOpen, property "color", colon, value "red", semicolon, braceClose

js("const n = 42;\n");
// keyword "const", whitespace, identifier "n", whitespace, operator "=", whitespace, number "42", punctuation ";", whitespace
```

Write your own lexer:

```js
import { Lexer } from "@papit/lexer";

const words = new Lexer({
    data: [
        { condition: /\s/, action: (ctx, char, buffer) => buffer && ctx.emit(buffer) },
    ],
    EOF: [
        { condition: () => true, action: (ctx, char, buffer) => ctx.emit(buffer) },
    ],
}, "data", {});

words.run("split these words"); // ["split", "these", "words"]
```

# API

### `Lexer`

```ts
class Lexer<Ctx = any, Token = any> {
    constructor(rules: StateRules<Ctx>, initialState: string, initialCtx: Ctx)
    run(input: string): Token[]
}
```

`run` walks `input` one character at a time. In the current state, the first rule whose `condition` matches runs its `action`, then moves to `next` if set. A character no rule matches is appended to the buffer. At the end, if the buffer isn't empty, the first `EOF` rule's action runs with `char` set to `"EOF"`.

A lexer keeps its state and tokens between calls: create a new one per input.

### Rules

```ts
interface StateRules<Ctx, Token> {
    [state: string]: StateRule<Ctx, Token>[];
}
interface StateRule<Ctx, Token> {
    condition: string | RegExp | ((char?: string, index?: number) => boolean);
    next?: string;
    action?: (ctx, char: string, buffer: string) => void;
}
```

| `condition` | Matches when |
| --- | --- |
| `string` | the character equals it |
| `RegExp` | it tests the character |
| function | it returns `true` for the character and its index |

The `ctx` passed to an action is a shallow copy of `initialCtx` plus three helpers:

| Helper | Description |
| --- | --- |
| `append(char)` | adds to the buffer |
| `emit(token)` | pushes a token and clears the buffer |
| `reconsume()` | processes the current character again, in the new state |

### Tokenizers

```ts
function html(value: string): HtmlToken[]
function css(value: string): CSSToken[]
function js(value: string): JSToken[]
```

| Function | Token types |
| --- | --- |
| `html` | `text`, `doctype`, `comment`, `startTag` (`name`, `attributes`, `selfClosing`), `endTag` (`name`) |
| `css` | `selector`, `property`, `value`, `atRule`, `comment`, `braceOpen`, `braceClose`, `colon`, `semicolon` |
| `js` | `keyword`, `identifier`, `number`, `string`, `template`, `operator`, `punctuation`, `whitespace`, `comment` |

Every token except the bare punctuation ones carries a `value` string. `cssRules` and `jsRules` are exported to build on.

### Limits

- `css` handles flat rule sets. Rules nested in an at-rule block (e.g. inside `@media`) come out as properties and values.
- `js` is a syntax-highlighting grade tokenizer: no regex literals, no distinction between division and other `/` uses.
- `reconsume()` on the last character of the input has no effect, so `js` drops a final operator or punctuation character (`js("a;")` gives only `a`). End JavaScript input with whitespace.

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

- [@papit/html](https://github.com/onkelhoy/papit/tree/main/packages/runtime/html) - HTML parser and DOM built on this lexer
