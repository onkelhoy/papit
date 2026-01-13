# Deep Dive into Packages Structure

The `@papit` ecosystem's package architecture is meticulously designed to promote modular development and enhance component reuse. This section delves into the architecture and organization of packages within the ecosystem, emphasizing the layered architectural approach that facilitates scalability and extensibility.

## Architectural Overview

At the heart of each package is a layered architecture that borrows from the principles of atomic design, yet introduces additional layers to accommodate a broader range of functionalities. This approach not only aids in organizing components based on their complexity but also in extending functionalities with minimal effort.

- **Future Evolution**: The current structure is poised for significant evolution, with plans to further refine and expand the architectural model. This evolution aims to better align with the dynamic needs of web component development and the overarching goals of the `@papit` ecosystem.

- **Layered Structure**:
  1. **Atoms**: The most basic building blocks, used across different components for uniformity.
  2. **Molecules**: Groups of atoms bonded together, forming more complex interfaces.
  3. **Organisms**: Complex UI components made up of molecules and possibly atoms.
  4. **Pages**: Complete pages or screen templates composed of organisms.
  5. **Templates**: Architectural patterns or layouts for organizing pages and organisms.
  6. **Tools**: Utility components and helpers that facilitate development but aren't directly UI-related.
  7. **System**: Core system functionalities that support the infrastructure of components, including internal rendering mechanisms and decorators.

## Package Composition

Each package is crafted to be a self-contained unit, embodying a specific segment of functionality within the ecosystem. This encapsulation ensures that packages can be developed, maintained, and upgraded independently, promoting a robust and flexible development environment.

### Key Components

- `.scripts/`: Local scripts for package-specific tasks, aiding in development and deployment processes.
- `asset/`: Static assets that are essential to the package’s functionality. This includes icons, stylesheets, and more.
- `react/`: Auto-generated React wrappers for web components, enabling seamless integration into React applications.
- `views/`: Demonstration pages showcasing the package's components in action, typically following a server-side rendering structure.
- `src/`: The source code directory, containing the logic, styles, and component definitions.
- `test/`: (Planned) A dedicated space for automated tests to ensure component reliability and stability.
- `custom-elements.json`: An analysis output of the package’s components, offering insights into their structure and behavior.
- `package.json`: Defines the package, its dependencies, and scripts for management tasks.
- `tsconfig.json`: The TypeScript configuration file, outlining the compiler options for the package.
- `.env`: Environment variables essential for the scripts and development environment, providing configuration flexibility.

This comprehensive structure underpins the `@papit` ecosystem's commitment to delivering high-quality, reusable components. By adhering to this structured approach, the ecosystem ensures that each package is both individually robust and seamlessly integrable within larger applications, fostering an environment of innovation and efficiency.

### Local Scripts

Within each package of the `@papit` ecosystem, the `.scripts` directory plays a pivotal role in maintaining the autonomy and operational efficiency of the package development lifecycle. Termed as **"local"** scripts, these tools are designed to streamline the build process, facilitate debugging, and enhance code analysis by interfacing seamlessly with the ecosystem's global scripts. Below is a detailed overview of the primary scripts available at the package level and their intended use cases:

- **Build Process (`build`)**: This script initiates the TypeScript compiler (`tsc`) to transpile the package's code. Upon successful compilation, it invokes `esbuild` for bundling and optional minification. The `--prod` flag can be appended to suppress source map generation and enforce minification, optimizing the output for production environments.

- **Development Watch Mode (`watch`)**: Aimed at enhancing the developer's experience, this script leverages TypeScript's watch mode to actively monitor code changes. It provides real-time feedback and compilation, facilitating immediate debugging and iterative development.

- **Local Server and Demo Viewing (`start`)**: Merging the build and watch capabilities, this script additionally triggers a local server to serve a specified view folder, typically for demonstration purposes. By default, it targets the `demo` directory, although an alternative folder can be specified via a reference argument, enabling developers to test different scenarios or component states easily.

- **Code Analysis (`analyse`)**: This utility script calls upon a global analysis tool to evaluate the package's codebase, identifying components and their attributes. It supports `--force` and `--verbose` flags for a more thorough and explicit analysis output, aiding in documentation and component inspection.

- **React Integration (`react`)**: Specifically designed to bridge web components with React applications, this script generates React wrapper components for seamless integration. It ensures that web components can be utilized within React projects with minimal friction, promoting cross-framework compatibility. The script allows for forced regeneration (`--force`) and verbose output (`--verbose`) for comprehensive control over the generation process.

- **Isolation and Bundling (`isolate`)**: In scenarios where an isolated environment is required for debugging or testing, this script packages the complete output of a package, including all dependencies. While its utility is niche, it provides an invaluable tool for thorough examination and troubleshooting.

The local scripts within each package are a testament to the `@papit` ecosystem's commitment to developer efficiency and operational flexibility. By providing a robust suite of tools tailored to the needs of package development, these scripts ensure that each component within the ecosystem can be developed, tested, and refined with precision and ease.

### Integration with React

The `react` directory within a package of the `@papit` ecosystem embodies a crucial bridge between custom web components and React applications. This directory is automatically generated through the execution of the `npm run react` command, aimed at creating React-compatible wrappers for the web components developed within the package. This seamless integration facilitates the use of `@papit` web components in React projects, ensuring a wide applicability and ease of adoption.

**Directory Structure and Contents:**

Upon generation, the `react` folder contains the following core files:

- **`declarations.d.ts`**: This TypeScript declaration file ensures type safety and provides TypeScript users with auto-completion and API hints, enhancing the development experience by making the integration of web components into React applications as smooth as possible.

- **`index.ts`**: Acts as the entry point for the React wrappers, exporting all generated React components. This file plays a pivotal role in bundling the components together, allowing for easy importation within React projects.

- **Component Wrapper Files (`*.tsx`)**: For each web component, a corresponding `.tsx` file is created, such as `<sub-component-classname>.tsx` and `<component-classname>.tsx`. These files contain the React wrapper components, enabling the web components to be utilized within React as if they were native React components.

**Usage in React Projects:**

To use the `@papit` web components in a React application, the components must first be imported from the package, as shown in the example below:

```tsx
import { Button } from "@papit/button/react";

function App() {
  return <Button>Hello World</Button>;
}
```

This approach allows React developers to integrate `@papit` web components into their applications effortlessly, benefiting from the rich feature set and performance optimizations inherent to the `@papit` ecosystem.

**Regeneration and Customization:**

The `react` directory is only regenerated if it does not exist or if the `--force` flag is used, providing developers the flexibility to customize the generated React wrapper components as needed. This design decision ensures that manual adjustments to the React wrappers are preserved, allowing for fine-tuned integration and usage within diverse project requirements.

By offering a dedicated mechanism for React integration, the `@papit` ecosystem not only broadens its usability across different development environments but also underscores its commitment to interoperability and developer convenience.

### The `views` Directory: Showcasing Components

Within each package of the `@papit` ecosystem, the `views` directory serves as a vital component, primarily facilitating the demonstration and testing of web components in a server-side rendering (SSR) context. This directory is structured to emulate a simplified web environment, allowing developers and users alike to visually inspect and interact with the components in a real-world scenario.

**Structure and Contents:**

The `views` directory is organized into subdirectories, each corresponding to a specific view or demonstration scenario for the package's components. A typical subdirectory within `views` includes the following files:

- **`index.html`**: The HTML file that acts as the entry point for the view. It contains the markup necessary to load and display the web components.
- **`style.css`**: This CSS file is used to style the view. It can include general styling or specific styles intended to enhance the demonstration of the components.
- **`main.js`**: The JavaScript file that initializes the components and possibly includes interaction logic or demonstration-specific scripting.

**Demonstration and Usage:**

To facilitate easy access and testing of these views, a development server can be started using the command `npm start sub-folder`, where `sub-folder` is the name of the specific view you wish to serve. This command performs several actions:

1. **Locating the View**: The server script first verifies the existence of the `index.html` file within the specified sub-folder of the `views` directory.
2. **Bundling JavaScript**: Utilizing `esbuild`, the server bundles the `main.js` file along with any dependencies. This step ensures that the modern JavaScript and module imports used within `main.js` are compiled into a format compatible with a wide range of browsers.
3. **Serving the View**: Finally, the view is served, allowing the developer to interact with the components in a browser environment. This setup is particularly useful for testing component behaviors, styling, and integration with other web technologies.

The `views` directory, with its straightforward structure and close resemblance to traditional web project layouts, offers an intuitive means for developers to showcase and evaluate their components. By providing a direct and interactive way to experience components, the `views` directory enhances the overall development process, aiding in both the refinement of components and the demonstration of their capabilities.

### Navigating the `src` Directory: A Deep Dive into Component Architecture

The `src` directory within each package of the `@papit` ecosystem serves as the backbone of component development, housing the source code that defines the behavior, appearance, and structure of web components. This directory's structured approach facilitates a clear separation of concerns, enhancing maintainability and scalability of the components. Here’s a closer examination of its key elements:

**Directory Layout and Key Files:**

- **`components/`**: This subdirectory is dedicated to the modular organization of component logic and styles. Each sub-component resides in its folder, containing both its TypeScript logic (`index.ts`) and SASS styling (`style.scss`), ensuring that each component is self-contained.

- **`component.ts`**: The core logic of the main component is defined here. This TypeScript file encapsulates the functionality, event handling, and properties of the component, serving as the central script for component behavior.

- **`register.ts`**: Essential for the integration of web components within the browser environment, this script registers the components using the Custom Elements API, enabling their use as HTML tags. The package’s `package.json` explicitly exports this file under the `/wc` path, facilitating easy import and utilization of components in web projects.

- **`index.ts`**: Acting as the entry point for the package, this file exports the main component, sub-components, and any types or interfaces defined in `types.ts`. This organization supports a clean import structure for developers using the package.

- **`types.ts`**: Here, TypeScript interfaces and types specific to the components are defined, promoting type safety and enhancing developer experience with auto-completion and compile-time checks.

- **`style.scss`**: The global SASS stylesheet for the package, where shared styles and variables are defined. It complements component-specific styles, ensuring a consistent visual theme across the package.

**Component and Style Integration:**

The use of SASS for styling allows developers to leverage variables, mixins, and nested rules, leading to more organized and maintainable stylesheets. The conversion of these styles into consumable JavaScript (`style.ts`) ensures that styles are closely bundled with their corresponding components, allowing for dynamic loading and encapsulation.

**Web Component Registration and Usage:**

The `register.ts` file plays a pivotal role in making the components ready for use in web applications. By registering components as custom elements, they can be directly used within HTML files or other JavaScript frameworks, maintaining the flexibility and reusability of the components.

Example of component usage in an HTML file:

```html
<script type="module">
  import "@papit/button/wc";
</script>

<pap-button>Hello World</pap-button>
```

This approach simplifies the inclusion of `@papit` components in projects, allowing developers to integrate sophisticated web components with minimal overhead.

The `src` directory's architecture underscores the `@papit` ecosystem's commitment to providing a robust, scalable, and developer-friendly framework for web component development. By adhering to these structured practices, the ecosystem ensures the delivery of high-quality components that are both versatile and easy to integrate across various web development projects.
