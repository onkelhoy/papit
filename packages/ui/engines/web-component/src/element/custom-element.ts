/**
 * @fileoverview Defines the `CustomElement` base class for building
 * declarative, reactive custom elements with efficient template rendering.
 *
 * @details
 * **Core Features:**
 * - **Declarative Rendering** — Uses a `render()` method that can return either a string or an `Element`.
 * - **Template Diffing** — Backed by `TemplateInstance` for efficient updates without replacing the whole DOM.
 * - **Debounced Updates** — Integrates `requestUpdate()` with configurable debounce delay.
 * - **Reactive Attributes** — Supports observed attributes and property decorators for sync between DOM and JS.
 * - **Query Decorators** — Automatically resolves `@query`-decorated fields after each render.
 * - **Lifecycle Hooks**:
 *   - `firstRender()` — Called once after the initial render.
 *   - `connectedCallback()` / `disconnectedCallback()` — Standard custom element lifecycle.
 *
 * **Render Flow:**
 * 1. `connectedCallback()` triggers the first `update()`.
 * 2. `update()` renders the template and updates only changed parts.
 * 3. Decorator queries are resolved after each render.
 *
 * @example
 * ```ts
 * class MyElement extends CustomElement {
 *   render() {
 *     return html`<div>Hello ${this.name}</div>`;
 *   }
 * }
 * customElements.define('my-element', MyElement);
 * ```
 *
 * @see {@link TemplateInstance} — Handles part-based DOM updates.
 * @see {@link html} — Tagged template function for building DOM trees.
 *
 * @created 2025-08-11
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 */

import { html, getValues } from "../html";
import { TemplateInstance, partFactory } from '../html/part';
import { debounceFn } from "../functions/debounce";
import { PropertyMeta, QueryMeta, Setting } from "./types";

const defaultSetting: ShadowRootInit & Partial<Setting> = {
    mode: "open",
}

/**
 * Base class for custom elements with declarative template rendering.
 * Uses a `TemplateInstance` for efficient updates without re-rendering the entire DOM.
 * Supports reactive attributes, property decorators, and query decorators.
 */
export class CustomElement extends HTMLElement {

    /**
     * List of attributes to observe for changes.
     * Should be populated by decorators or subclasses.
     */
    static get observedAttributes() {
        return [];
    };

    /**
     * Style string(s)
     */
    static sheet: CSSStyleSheet;
    // static style: string;
    // static styles: string[];

    /**
     * Returns the root node into which content is rendered:
     * - If `templateInstance` exists, returns its root element
     * - Else, if the element has a shadow root, returns it
     * - Else, returns the element itself
     */
    get root() {
        if (this.shadowRoot) return this.shadowRoot;
        return this as HTMLElement;
    }

    // private styleElement: HTMLStyleElement | null = null;

    originalHTML: string;

    /**
     * Creates a new custom element.
     * @param shadowRootInit Options for `attachShadow`, merged with defaults.
     *                       Can also include custom settings such as `requestUpdateTimeout`.
     */
    constructor(shadowRootInit?: Partial<ShadowRootInit> & Partial<Setting>) {
        super();
        const settings = {
            ...defaultSetting,
            ...(shadowRootInit ?? {})
        }

        this.attachShadow(settings);
        this.requestUpdate = debounceFn(this.update, settings.requestUpdateTimeout ?? 50);
        this.originalHTML = this.outerHTML;
    }


    /**
     * Lifecycle: called when element is added to the DOM.
     * Triggers the first update/render.
     */
    connectedCallback() {
        this.update();
    }

    /**
     * Lifecycle: called when element is removed from the DOM.
     * Empty by default, but subclasses can override.
     */
    disconnectedCallback() { }

    /**
     * Lifecycle: called when an observed attribute changes.
     * Forwards changes to any registered property update handlers.
     * @param name The attribute name
     * @param oldValue Previous attribute value
     * @param newValue New attribute value
     */
    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        if (!this.propertyMeta) return;

        const update = this.propertyMeta.get(name);
        if (update) update.call(this, newValue, oldValue);
    }

    /**
     * Hook called after the first render completes.
     * Subclasses should call super.firstRender to get styling to work 
     */
    firstRender() {
        // inside firstRender() or constructor
        const sheet = (this.constructor as any).sheet;
        console.log('hello?', this.shadowRoot, sheet)
        if (this.shadowRoot && sheet)
        {
            // this.shadowRoot.adoptedStyleSheets = [
            //     ...(this.shadowRoot.adoptedStyleSheets ?? []),
            //     (this.constructor as any).sheet
            // ];

            if (sheet instanceof CSSStyleSheet)
            {
                console.log('styleobject');
                this.shadowRoot.adoptedStyleSheets = [sheet];
            }
            else if (typeof sheet === "string")
            {
                console.log('string BAJS');
                const s = new CSSStyleSheet();
                s.replaceSync(sheet);
                this.shadowRoot.adoptedStyleSheets = [s];
            }
            else 
            {
                console.log("ELSE CASE", Object.keys(sheet));
            }
        }


    }

    /**
     * Renders (or updates) the component's DOM inside its root.
     *
     * **Behavior:**
     * - If `render()` returns a raw HTML string, it is parsed into a DOM `Element` via {@link html}.
     * - On first render:
     *   - Appends the rendered element to `this.root`.
     *   - Wraps it in a `TemplateInstance` for marker-based updates (if it came from a tagged template).
     *   - Calls `firstRender()` and dispatches the `"first-render"` event.
     * - On subsequent renders:
     *   - If the render output was from a tagged template, retrieves its dynamic values with {@link getValues} and calls `TemplateInstance.update()` to patch the DOM.
     *   - If the render output was a string-based template, no diffing occurs (it’s treated as static DOM).
     * - Always resolves any `@query`-decorated properties after rendering.
     *
     * @throws {Error} If `render()` returns `null`, `undefined`, or any falsy value.
     */
    update() {
        let newRoot = this.render();
        let isString = typeof newRoot === "string";
        if (typeof newRoot === "string") newRoot = html(newRoot);

        if (!newRoot) throw new Error("[error] core: no element returned from render");

        if (this.templateInstance == null)
        {
            this.root.appendChild(newRoot);
            this.templateInstance = new TemplateInstance(this.root, partFactory);
            this.firstRender();
            this.dispatchEvent(new Event("first-render"));
        }

        if (!isString) 
        {
            const newValues = getValues(newRoot);
            if (!newValues) return void console.error("[error] values could not be found")

            if (this.templateInstance) this.templateInstance.update(newValues);
        }

        this.findQueries();
    }

    /**
     * Requests an update to the DOM.
     * The update is debounced according to `requestUpdateTimeout`.
     */
    requestUpdate() { }

    /**
     * Queries for the first matching element within this element's render root.
     * @param selectors A valid CSS selector string
     */
    querySelector<T extends Element>(selectors: string) {
        return this.root.querySelector<T>(selectors);
    }
    /**
     * Queries for all matching elements within this element's render root.
     * @param selectors A valid CSS selector string
     */
    querySelectorAll<T extends Element>(selectors: string) {
        return this.root.querySelectorAll<T>(selectors);
    }

    /**
     * Returns the template to render.
     * Can return either:
     * - A string (will be converted to a template)
     * - An Element (template root)
     * @returns string|Element
     */
    render(): string | Node {
        return "Phuong is so kool"
    }

    // helper variables & private functions 
    private templateInstance: TemplateInstance | null = null;

    // decorator query 
    private queryMeta?: QueryMeta[];

    /**
     * Resolves `@query`-decorated properties by querying the render root.
     * If a `load` callback exists, it is invoked with the found element.
     */
    private findQueries() {
        if (!this.queryMeta) return;
        for (let meta of this.queryMeta)
        {
            if ((this as any)[meta.propertyKey]) continue;
            const elm = this.root.querySelector(meta.selector);
            if (meta.load) meta.load.call(this, elm);
            (this as any)[meta.propertyKey] = elm;
        }
    }

    /**
     * Calls getStyle and populates to the styleElement 
     * it will create the element if null
     */
    // renderStyle() {
    //     if (!this.shadowRoot) return;
    //     const styles = this.getStyle();
    //     if (this.styleElement == null)
    //     {
    //         this.styleElement = document.createElement("style");
    //         this.shadowRoot.appendChild(this.styleElement);
    //     }

    //     this.styleElement.innerHTML = styles;
    // }

    /**
     * combines both the static style together with the styles to form one big style 
     * @returns string
     */
    // getStyle() {
    //     // Get the constructor of the child class
    //     const childConstructor = (this.constructor as any) as typeof CustomElement & { style?: string; styles?: string[]; };

    //     // Access the static property on the child class
    //     const styles = [
    //         ...(childConstructor.styles ?? []),
    //         ...(typeof childConstructor.style === "string" ? [childConstructor.style] : []),
    //     ];

    //     return styles.join(' ');
    // }

    // decorator property 
    private propertyMeta?: PropertyMeta;
}