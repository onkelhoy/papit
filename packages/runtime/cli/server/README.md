# @papit/server

A simple but powerful development server for modern JavaScript/TypeScript projects.

![Logo](https://raw.githubusercontent.com/onkelhoy/papit/refs/heads/main/asset/logo.svg)

`@papit/server` can serve your **local assets, package files, dependency assets**, and automatically handle **live updates, bundling, and caching**. It’s ideal for developers who want a **fast, flexible dev environment** with **asset localization, HTML/JS bundling, import maps, and dependency-aware serving**.

**Key features:**

- 📦 Serves local project files and assets
- 🌐 Handles package and dependency assets automatically
- ⚡ Supports live-reload updates for JavaScript/TypeScript
- 🗂 Efficient caching mechanism for files, HTML, and bundles
- 🖼 Automatic handling of images, fonts, audio, video, and other binary assets
- 🛠 Dev-friendly HTTP error handling (`404`, `500`, `405`)
- 🔌 Optional bundling via `@papit/build` for `.ts`/`.tsx` files
- 🧩 Importmap support for module resolution across packages

---

![Type](https://img.shields.io/badge/Type-network-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/server.svg?logo=npm)](https://www.npmjs.com/package/@papit/server)

---

## Installation

```bash
npm install @papit/server
```

---

## Usage

Basic usage:

```bash
npx @papit/server
```

- Starts a dev server on the default port `3000` (or the port specified with `--port`)
- Serves your project assets, HTML, and bundled JavaScript/TypeScript
- Supports **live reload** for client updates
- Automatically handles caching and streaming for large assets

---

## Flags & Configuration

All runtime flags are centralized here for easy reference. Flags can be passed via CLI or environment variables.

| Flag             | Type            | Default                       | Description                           |
| ---------------- | --------------- | ----------------------------- | ------------------------------------- |
| `--port`         | number          | 3000                          | Set the server port                   |
| `--live`         | boolean         | false                         | Enable live updates (hot reload)      |
| `--no-bundle`    | boolean         | false                         | Skip bundling of JS/TS files          |
| `--asset`        | string or array | `["asset","assets","public"]` | Custom asset folder(s) to serve       |
| `--cache-file`   | number (MB)     | 50                            | Max cache size for individual files   |
| `--cache-html`   | number (MB)     | 50                            | Max cache size for HTML files         |
| `--cache-bundle` | number (MB)     | 150                           | Max cache size for bundled JS files   |
| `--verbose`      | boolean         | false                         | Enable verbose logging                |
| `--info`         | boolean         | false                         | Show info logs                        |
| `--error`        | boolean         | false                         | Show error traces                     |
| `--silent`       | boolean         | false                         | Suppress console output               |
| `--no-cache`     | boolean         | false                         | Disable caching entirely              |
| `--location`     | string          | -                             | Override project root location        |
| `--mode`         | string          | "dev"                         | Server mode (`dev`/`prod`)            |
| `--buildMode`    | string          | "ancestors"                   | Build mode (`ancestors`/`workspaces`) |

> **Note:** Some flags (like `--prod`, `--watch`, `--callback`) are inherited from [@papit/build](https://github.com/onkelhoy/papit/tree/main/packages/runtime/build/README.md). Please check the build README for advanced options.

---

## Contributing

Contributions are welcome! Please follow the development guidelines and ensure all tests pass before submitting a pull request.

---

## License

Licensed under the **@Papit License 1.0** – Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Support

For issues, questions, or contributions, visit the [GitHub repository](https://github.com/onkelhoy/papit).
