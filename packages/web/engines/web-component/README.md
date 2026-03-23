# @papit/web-component

the root component for @papit web components, this package deals with all the heavy lifting such as reactive rendering, properties etc

---

![Type](https://img.shields.io/badge/Type-design-system-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/web-component.svg?logo=npm)](https://www.npmjs.com/package/@papit/web-component)

---

## installation

```bash
npm install @papit/web-component
```

---

### Documentation

📄 **[Full Documentation →](./docs/README.md)**

### Acknowledgements

💌 Special thanks to my loving wife **Phuong** — your support and patience make all the difference. 💛

---

## Development Workflow

Development takes place inside the `src` folder.

### Adding a new subcomponent

```bash
npm run component:add
```

This will:

- Update `.env`
- Create a view folder
- Create the corresponding folder under `src/components`
- Generate starter files

---

## Styling

- Edit styles in `style.css`
- Styles are automatically imbedded into the JS thanks to esbuild.

---

## Live Preview (see more @papit/server)

To preview during development:

```bash
npm start
```

This launches a demo server from the `views` folder.

---

## Assets

- **Component assets** (icons, translations, etc.) → store in `assets/`
- **Demo-only assets** → store in `views/<demo>/public/`

---

## Available Commands

| Command     | Description                                                                        |
| ----------- | ---------------------------------------------------------------------------------- |
| **build**   | Builds the component. Add `--prod` for minification.                               |
| **watch**   | Watches for file changes and rebuilds.                                             |
| **start**   | Starts the demo server for a specific view.                                        |
| **analyse** | Generates an analysis file (with `--verbose` and/or `--force` flags).              |
| **react**   | Generates React wrappers for components (with `--verbose` and/or `--force` flags). |

---

## Example — Creating a Counter Component

Below is a small but complete example showing several key features in `@papit/web-component`:

- **Reactive properties** via `@property`
- **DOM queries** via `@query`
- **Event debouncing** via `@debounce` and `debounceFn`
- **Method binding** via `@bind`
- **Declarative rendering** via the `html` tag

```ts
import {
  CustomElement,
  html,
  property,
  query,
  debounce,
  bind,
  debounceFn,
} from "@papit/web-component";

class MyCounter extends CustomElement {
  @property({ type: Number }) count = 0;
  @query("#incBtn") incrementButton!: HTMLButtonElement;

  @debounce(300)
  handleIncrement() {
    this.count++;
  }

  @bind
  handleReset() {
    this.count = 0;
  }

  render() {
    return html`
      <h2>Count: ${this.count}</h2>
      <button id="incBtn" @click=${this.handleIncrement}>+1</button>
      <button @click=${this.handleReset}>Reset</button>
    `;
  }
}

customElements.define("my-counter", MyCounter);
```

Once registered, you can use it anywhere:

```html
<my-counter></my-counter>
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
