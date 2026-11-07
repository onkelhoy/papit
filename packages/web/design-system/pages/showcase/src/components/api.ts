// system
import { CustomElement, html, property, unsafeHTML } from "@papit/web-component";

// foundations
import "@papit/checkbox";
import "@papit/input";

// tools
import { translate, useTranslator } from "@papit/translator";

// local
import sheet from "./api.css" with { type: "css" };
import type { ShowcaseEntry } from "../types";

type AnalyseProperty = { name: string; type: string; attribute?: string | false; default?: string; description?: string };
type AnalyseNamed = { name: string; description?: string; kind?: string; default?: string };
type AnalyseCore = {
    className: string;
    description?: string;
    properties: AnalyseProperty[];
    events: AnalyseNamed[];
    states: string[];
    html: { slots: AnalyseNamed[]; parts: AnalyseNamed[] };
    css: { variables: AnalyseNamed[] };
    extends?: AnalyseCore & { source?: { package?: string } };
};
type AnalyseElement = AnalyseCore & { tagName: string };

/** The string literals of a union type, `'"a" | "b"'` → `["a", "b"]`; empty when it's not one. */
export function unionOptions(type: string) {
    const parts = type.split("|").map(part => part.trim()).filter(part => part !== "undefined" && part !== "null");
    if (parts.length === 0 || !parts.every(part => /^(["']).*\1$/.test(part))) return [];
    return parts.map(part => part.slice(1, -1));
}

/** Own properties plus those inherited from other design-system packages, never the engine's. */
function collectProperties(element: AnalyseCore) {
    const seen = new Set<string>();
    const result: AnalyseProperty[] = [];
    let current: AnalyseCore | undefined = element;
    while (current)
    {
        const source = (current as AnalyseCore & { source?: { package?: string } }).source?.package;
        if (current !== element && source === "@papit/web-component") break;
        for (const property of current.properties)
        {
            if (seen.has(property.name)) continue;
            seen.add(property.name);
            result.push(property);
        }
        current = current.extends;
    }
    return result;
}

/**
 * Playground and reference built from a package's `analyse.json`: a live element with a control
 * per property, then tables of events, slots, parts, states and CSS variables.
 *
 * @element pap-showcase-api
 */
export class ShowcaseApi extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator("showcase.api");

    /** The package to describe. */
    @property({
        type: Object,
        attribute: false,
        rerender: true,
        after(this: ShowcaseApi) {
            this.load();
        }
    }) entry?: ShowcaseEntry;
    /** Site base URL the package files resolve against. */
    @property({ rerender: false }) base = "";

    @property({ type: Array, attribute: false, rerender: true }) elements: AnalyseElement[] = [];
    @property({ attribute: false, rerender: true }) error = "";

    private async load() {
        this.elements = [];
        this.error = "";
        if (!this.entry) return;

        try
        {
            const response = await fetch(new URL(`packages/${this.entry.path}/analyse.json`, this.base || document.baseURI));
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const data = await response.json() as { elements?: AnalyseElement[] };
            // the live element needs its definition
            await import(this.entry.name).catch(() => null);
            this.elements = data.elements ?? [];
        }
        catch (error)
        {
            this.error = error instanceof Error ? error.message : String(error);
        }
    }

    private preview(tagName: string) {
        return this.shadowRoot?.querySelector<HTMLElement>(`[data-preview="${tagName}"] > *`);
    }

    private setValue(tagName: string, property: AnalyseProperty, value: string | boolean) {
        const element = this.preview(tagName);
        if (!element) return;

        if (property.attribute)
        {
            if (value === false || value === "") element.removeAttribute(property.attribute);
            else element.setAttribute(property.attribute, value === true ? "" : value);
        }
        else
        {
            (element as any)[property.name] = value;
        }
    }

    private renderControl(tagName: string, property: AnalyseProperty) {
        const type = property.type.replace(/\s*\|\s*undefined/g, "");
        const options = unionOptions(property.type);
        const label = property.name;

        if (type === "boolean")
        {
            return html`
                <pap-checkbox
                    checked="${property.default === "true" ? "true" : ""}"
                    @change="${(e: Event) => this.setValue(tagName, property, !!(e.target as any).checked)}"
                >${label}</pap-checkbox>
            `;
        }

        if (options.length > 0)
        {
            return html`
                <label>
                    <span>${label}</span>
                    <select @change="${(e: Event) => this.setValue(tagName, property, (e.target as HTMLSelectElement).value)}">
                        <option value=""></option>
                        ${options.map(option => html`<option value="${option}">${option}</option>`)}
                    </select>
                </label>
            `;
        }

        if (type === "string" || type === "number")
        {
            return html`
                <label>
                    <span aria-hidden="true">${label}</span>
                    <pap-input
                        aria-label="${label}"
                        type="${type === "number" ? "number" : "text"}"
                        @input="${(e: Event) => this.setValue(tagName, property, (e.target as any).value ?? "")}"
                    ></pap-input>
                </label>
            `;
        }

        return null;
    }

    private renderTable(title: string, rows: AnalyseNamed[], extra?: keyof AnalyseNamed) {
        if (rows.length === 0) return null;
        return html`
            <h3>${title}</h3>
            <table>
                <thead><tr><th>${this.t("name")}</th>${extra ? html`<th>${this.t(extra)}</th>` : ""}<th>${this.t("description")}</th></tr></thead>
                <tbody>
                    ${rows.map(row => html`
                        <tr><td><code>${row.name}</code></td>${extra ? html`<td><code>${row[extra] ?? ""}</code></td>` : ""}<td>${row.description ?? ""}</td></tr>
                    `)}
                </tbody>
            </table>
        `;
    }

    private renderElement(element: AnalyseElement) {
        const properties = collectProperties(element);

        return html`
            <section part="element" aria-labelledby="${element.tagName}">
                <h2 id="${element.tagName}"><code>&lt;${element.tagName}&gt;</code></h2>
                ${element.description ? html`<p>${element.description.split("\n")[0]}</p>` : ""}

                <div part="playground">
                    <div part="preview" data-preview="${element.tagName}">
                        ${unsafeHTML(`<${element.tagName}>${element.className}</${element.tagName}>`)}
                    </div>
                    <form part="controls" aria-label="${this.t("controls")}" @submit="${(e: Event) => e.preventDefault()}">
                        ${properties.map(property => this.renderControl(element.tagName, property))}
                    </form>
                </div>

                ${properties.length > 0 ? html`
                    <h3>${this.t("properties")}</h3>
                    <table>
                        <thead><tr><th>${this.t("name")}</th><th>${this.t("attribute")}</th><th>${this.t("type")}</th><th>${this.t("default")}</th><th>${this.t("description")}</th></tr></thead>
                        <tbody>
                            ${properties.map(property => html`
                                <tr>
                                    <td><code>${property.name}</code></td>
                                    <td>${property.attribute ? html`<code>${property.attribute}</code>` : "—"}</td>
                                    <td><code>${property.type}</code></td>
                                    <td>${property.default ? html`<code>${property.default}</code>` : ""}</td>
                                    <td>${(property.description ?? "").split("\n")[0]}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                ` : ""}
                ${this.renderTable(this.t("events"), element.events, "kind")}
                ${this.renderTable(this.t("slots"), element.html.slots)}
                ${this.renderTable(this.t("parts"), element.html.parts)}
                ${this.renderTable(this.t("states"), element.states.map(name => ({ name })))}
                ${this.renderTable(this.t("variables"), element.css.variables, "default")}
            </section>
        `;
    }

    render() {
        if (this.error) return html`<p part="error">${this.t("error")} ${this.error}</p>`;
        return html`${this.elements.map(element => this.renderElement(element))}`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase-api": ShowcaseApi;
    }
}
