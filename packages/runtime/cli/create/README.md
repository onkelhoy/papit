# @papit/create

Project and package scaffolding tool for @papit — opinionated, consistent, and designed to kickstart Papit-based projects with the correct structure from day one.

![Logo](https://github.com/onkelhoy/papit/blob/main/asset/logo.svg)

This package is intended to be used **from within a workspace or an empty directory**. Simply run:

```bash
npm create @papit
```

to generate a fully initialized Papit package, component, or project with zero or minimal configuration.

---

![Type](https://img.shields.io/badge/Type-cli-orange)
[![Tests](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml/badge.svg)](https://github.com/onkelhoy/papit/actions/workflows/pull-request.yml)
[![NPM version](https://img.shields.io/npm/v/@papit/create.svg?logo=npm)](https://www.npmjs.com/package/@papit/create)

---

## CLI Flags

| Flag          | Description                         |
| ------------- | ----------------------------------- |
| `--package`   | Create a package                    |
| `--component` | Create a component                  |
| `--project`   | Create a project                    |
| `--agree`     | Skip confirmations                  |
| `--install`   | Install dependencies after creation |
| `--commit`    | Create an initial git commit        |
| `--verbose`   | Show detailed output                |

If no creation flag is provided, an interactive selector is shown.

---

## How it works

`@papit/create` presents a set of creation options. Some of these can be invoked directly via flags, but the tool is primarily interactive and focused on generating boilerplate code based on predefined templates.

There are currently three built-in runners:

1. `package`
2. `component`
3. `project`

**Note:** You can provide your own custom runners by placing them in the `bin` folder. Each runner must have a `runner.js` file with a default export, for example:

```
<workspace-root>/bin/runners/<custom>/runner.js
```

A runner is a function that receives two arguments:

```ts
info: {
  root: string; // Location of the workspace root
  local: string; // Location of the current package (if any)
  script: string | null; // Location of the @papit/create script
}
```

```ts
args: {
  flags: Record<string, string | string[] | true | undefined>,
  values: string[]
}
```

For more details on the structure and behavior of these arguments, see the 
- `@papit/arguments` 
- `@papit/information`
package.

---

## Package

The **package runner** creates a new package at a selected location (sometimes referred to as layers or folders).

A template is selected — either one of the built-in templates or a custom template located at:

```
<workspace-root>/bin/runners/package/*
```

The selected template folder is copied, and all files are processed to replace supported variables.

The generated license file automatically references the same license as the workspace root.

### Available variables

- `VARIABLE_NAME`
- `VARIABLE_FULL_NAME`
- `VARIABLE_DESCRIPTION`
- `VARIABLE_LAYER_FOLDER`
- `VARIABLE_PROJECTLICENSE`
- `VARIABLE_GITHUB_REPO`
- `VARIABLE_LOCAL_DESTINATION`
- `VARIABLE_CLASS_NAME`
- `VARIABLE_HTML_PREFIX`
- `VARIABLE_USER`

---

## Component

The **component runner** creates a new component and is intended for adding sub-components to an existing package.

Like the package runner, it copies a selected template from either built-ins or:

```
<workspace-root>/bin/runners/component/*
```

### Folder handling

- **views**
  If a `views` folder exists in both the current package and the template, a new subfolder named after the component is created inside the package’s `views` directory and populated with the template content.

- **src**
  If the current package already has a `src` folder with files, the template’s `src` content is typically placed under:

  ```
  src/components/<component-name>
  ```

### Available variables

- `VARIABLE_NAME`
- `VARIABLE_FULL_NAME`
- `VARIABLE_HTML_NAME`
- `VARIABLE_CLASS_NAME`

---

## Project

> ⚠️ This runner is currently under development.

The **project runner** creates a raw monorepo project at a selected destination.

As with packages and components, custom templates can be provided at:

```
<workspace-root>/bin/runners/project/*
```

You will be prompted to select a template during creation.

Licensing is handled interactively. You may provide an existing license file or omit it, in which case a standard MIT license is used.

### Available variables

- `VARIABLE_NAME`
- `VARIABLE_DESCRIPTION`
- `VARIABLE_PROJECTLICENSE`
- `VARIABLE_USER`

---

## Contributing

Contributions are welcome.

Please ensure that:

- Templates follow Papit conventions
- Runners remain deterministic
- Interactive prompts stay minimal

Open a pull request when ready 🚀

---

## License

Licensed under the **@Papit License 1.0**
Copyright (c) 2024 Henry Pap (@onkelhoy)

**Key points:**

- ✅ Free to use in commercial projects
- ✅ Free to modify and distribute
- ✅ Attribution required
- ❌ Cannot resell the component itself as a standalone product

See the [LICENSE](https://github.com/onkelhoy/papit/blob/main/LICENSE) file for full details.

---

## Support

For issues, questions, or contributions, please visit the
[GitHub repository](https://github.com/onkelhoy/papit).
