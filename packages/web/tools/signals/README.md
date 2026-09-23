# @papit/signals

Minimal reactive state for the browser: signals hold values, effects re-run when the signals they read change, and computed values derive from other signals.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

---

![Type](https://img.shields.io/badge/Type-tools-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/signals.svg?logo=npm)](https://www.npmjs.com/package/@papit/signals)

---

# Installation

```bash
npm install @papit/signals
```

---

# Usage

```javascript
import { signal, effect, computed } from "@papit/signals";

const [count, setCount] = signal(0);
const [double] = computed(() => count() * 2);

const stop = effect(() => {
    console.log(double()); // logs 0
});

setCount(1);          // logs 2
setCount(n => n + 1); // logs 4
stop();
setCount(10);         // nothing, the effect is stopped
```

## Entry points

| Import | For | Reactive |
| ------ | --- | -------- |
| `@papit/signals` | Browser (same as `/browser`) | Yes |
| `@papit/signals/browser` | Browser | Yes |
| `@papit/signals/node` | Node | Not yet, see Limits |

Both export the same three functions.

---

# API

## signal

```ts
function signal<T>(initial: T): readonly [read: () => T, write: (next: T | ((prev: T) => T)) => void]
```

Holds a value. Calling `read()` inside an `effect` or `computed` subscribes it. `write` takes a new value or an updater function, and re-runs every subscriber.

## effect

```ts
function effect(fn: () => void): () => void
```

Runs `fn` straight away, then again whenever a signal it read is written. Returns a function that stops it.

## computed

```ts
function computed<T>(fn: () => T): readonly [read: () => T, dispose: () => void]
```

A read-only signal holding `fn()`, recomputed whenever a signal `fn` reads is written. `dispose` stops the recomputation.

---

# Limits

- **The node entry isn't reactive yet.** Its `effect` runs once and never again, and `computed` keeps its first value. Its dispose is a no-op.
- Every `write` notifies subscribers, even when the value didn't change.
- There's no batching. An effect that reads both a signal and a `computed` derived from it runs twice per write.
- A function passed to `write` is always treated as an updater, so a signal can't hold a function directly. Wrap it: `write(() => myFn)`.
- Subscriptions from an earlier run of an effect aren't dropped, so an effect keeps re-running for a signal it stopped reading.
- Effects created inside another effect's run aren't supported; the outer effect stops tracking after the inner one finishes.

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

- [@papit/web-component](https://github.com/onkelhoy/papit/tree/main/packages/web/engines/web-component)
  The engine papit components are built on.
