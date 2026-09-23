# @papit/terminal

Terminal output for node CLIs: semantic logging, ANSI colours, spinners, interactive prompts and shell command helpers. Every papit CLI prints and spawns through it.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-node-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/terminal.svg?logo=npm)](https://www.npmjs.com/package/@papit/terminal)

---

# Installation

```bash
npm install @papit/terminal
```

# Usage

```js
import { Terminal } from "@papit/terminal";

Terminal.write("building", Terminal.bold("@papit/switch"));
Terminal.success("built in", 120, "ms");   // ● success built in 120 ms
Terminal.warn("no tests found");           // ● warn no tests found
```

Show a spinner while work runs:

```js
const { update, close } = Terminal.loading("Bundling");
update("Bundling types");
close();
```

Run a shell command and wait for it:

```js
await Terminal.execute("npm run build", process.cwd());

await Terminal.execute("ls", {
    cwd: "/",
    args: ["-d", "/tmp"],
    onData: text => Terminal.write(text.trim()),
});
```

Ask the user (needs an interactive TTY):

```js
const name = await Terminal.prompt("Package name", true);
const ok = await Terminal.confirm("Publish now?");
const { index, text } = await Terminal.option(["node", "web-component", "game"], "Package type");
```

# API

All members are static on `Terminal`.

### Logging

```ts
write(...values: any[]): void
success(...values: any[]): void
info(...values: any[]): void
warn(...values: any[]): void
error(...values: any[]): void
```

Values are joined with a space. `write` prints to stdout. `success`, `info`, `warn` and `error` print a coloured `● <kind>` prefix to **stderr**, so they stay out of piped output.

| Method | Description |
| --- | --- |
| `print(value, type?)` | writes `value` as is to stdout, or stderr when `type` is `"error"` |
| `printLine(value?, type?)` | `print` plus a newline |
| `clear(start?, end?)` | erases stdout lines from `end` (default: the current line count) back up to `start` |
| `surpress(callback)` | runs an async callback with stdout swallowed, returns its result |

### Colours and styles

```ts
red(...values: any[]): string
```

Return the values wrapped in an ANSI code, or plain text when stdout isn't a TTY.

| Kind | Methods |
| --- | --- |
| Colours | `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` |
| Bright colours | `brightBlack`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite` |
| Styles | `bold`, `dim`, `italic`, `underline`, `strikethrough`, `inverse` |

### `loading`

```ts
loading(text?: string, duration?: number, callback?: (frame: number) => void): { close(): void, update(text: string): void }
```

Spinner on the current line, one frame every `duration` ms (default `80`). `callback` runs on every frame. Without a TTY it prints nothing and both functions are no-ops.

### Prompts

```ts
prompt(promptText: string, inline?: boolean, cwd?: string): Promise<{ input: string, path: string }>
option(options: string[] | string[][], promptText?: string, currentMarker?: string, defaultMarker?: string): Promise<{ index: number, text: string }>
confirm(question: string, defaultValue?: boolean): Promise<boolean>
```

| Method | Description |
| --- | --- |
| `prompt` | free text input. `inline` puts the cursor after `promptText: `, otherwise on a `> ` line below it. Tab completes file system paths relative to `cwd`. The result's `path` is `input` resolved against `process.cwd()` (`~` expands to the home directory) and it converts to `input` as a string. |
| `option` | single choice from a list, moved with ↑/↓ or Tab/Shift+Tab, confirmed with Enter or Space. A `string[][]` renders each group with a blank line between. `index` counts across the flattened list. |
| `confirm` | yes/no via `option`. `defaultValue` decides which is listed first. |

Ctrl+C or Ctrl+D in a prompt prints `cancelled` and exits the process.

### Shell commands

```ts
execute(command: string, cwd: string, args?: string[]): Promise<void>
execute(command: string, options: Partial<SpawnOptions>): Promise<void>
spawn(command: string, options: Partial<SpawnOptions>): ChildProcess
```

`spawn` runs `command` plus `args` joined by spaces in a shell, collecting stdout and stderr. `execute` wraps it in a promise that resolves on exit code `0`, and rejects with an `Error` carrying stderr (or stdout) otherwise. When `CI` is set, output is inherited instead of captured, so `onData` doesn't fire.

| SpawnOptions | Type | Description |
| --- | --- | --- |
| `cwd` | `string` | working directory |
| `args` | `string[]` | appended to the command, unquoted |
| `onData` | `(text) => void` | each stdout chunk |
| `onClose` | `(code, stdout, stderr) => void` | on exit (with `execute`, only on success) |
| `onError` | `(error, stdout, stderr) => void` | if the process failed to start (`spawn` only) |

### Sessions

`createSession()`, `clearSession(session?)`, `closeSession()` and `sessionBlock(callback)` mark a line position in stdout and erase everything printed after it. `option` uses them to redraw in place. `Terminal.lines` is the running count of stdout newlines they rely on.

# Design notes

Importing the package has process-wide side effects:

- `process.stdout.write` is wrapped to count lines for `clear` and sessions.
- An `unhandledRejection` handler logs the reason and exits with code `1`.

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

- [@papit/arguments](https://github.com/onkelhoy/papit/tree/main/packages/runtime/cli/arguments) - flag parsing and the shared log level
