// system
import { CustomElement, html, property } from "@papit/web-component";

// foundations
import "@papit/button";
import "@papit/input";

// tools
import { translate, useTranslator } from "@papit/translator";

// local
import sheet from "./translations.css" with { type: "css" };
import type { ShowcaseEntry } from "../types";

/** One translation key of one package, with a value per language id. */
export type TranslationRow = { package: string; key: string; values: Record<string, string> };

/** Nested translation json → dot keys; `meta` is left out. */
export function flatten(json: Record<string, unknown>, prefix = ""): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in json)
    {
        if (!prefix && key === "meta") continue;
        const value = json[key];
        const name = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(result, flatten(value as Record<string, unknown>, name));
        else result[name] = String(value ?? "");
    }
    return result;
}

/** The package and every workspace package it depends on, transitively, in that order. */
export function withDependencies(entry: ShowcaseEntry, packages: ShowcaseEntry[]) {
    const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
    const result: ShowcaseEntry[] = [];
    const seen = new Set<string>();
    const visit = (pkg: ShowcaseEntry) => {
        if (seen.has(pkg.name)) return;
        seen.add(pkg.name);
        result.push(pkg);
        for (const name of pkg.dependencies)
        {
            const dependency = byName.get(name);
            if (dependency) visit(dependency);
        }
    };
    visit(entry);
    return result;
}

/** RFC 4180 CSV: every field quoted, quotes doubled, CRLF line ends. */
export function toCSV(rows: string[][]) {
    return rows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}

/**
 * Table of a package's translations: a row per key, a column per language. `mode="dependencies"`
 * adds the translations of every workspace package it depends on. New language columns can be
 * added and filled in, and the table exported as CSV.
 *
 * @element pap-showcase-translations
 */
export class ShowcaseTranslations extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator("showcase.translations");

    /** The package whose translations are shown. */
    @property({
        type: Object,
        attribute: false,
        after(this: ShowcaseTranslations) {
            this.added = [];
            this.load();
        }
    }) entry?: ShowcaseEntry;
    /** Every package in the manifest, used to follow dependencies. */
    @property({ type: Array, attribute: false }) packages: ShowcaseEntry[] = [];
    /** Site base URL the package files resolve against. */
    @property({ rerender: false }) base = "";
    /** `focus`: this package only. `dependencies`: also every package it depends on. */
    @property({
        rerender: true,
        after(this: ShowcaseTranslations) {
            this.load();
        }
    }) mode: "focus" | "dependencies" = "focus";

    @property({ type: Array, attribute: false, rerender: true }) rows: TranslationRow[] = [];
    /** Language columns added in the table, editable. */
    @property({ type: Array, attribute: false, rerender: true }) added: string[] = [];
    private loading = 0;

    /** Language ids in column order: loaded ones, then added ones. */
    get languages() {
        const ids = new Set<string>();
        for (const row of this.rows) for (const id in row.values) ids.add(id);
        for (const id of this.added) ids.add(id);
        return [...ids];
    }

    private async load() {
        const entry = this.entry;
        if (!entry) return;
        const run = ++this.loading;

        const targets = this.mode === "dependencies" ? withDependencies(entry, this.packages) : [entry];
        const rows: TranslationRow[] = [];

        for (const pkg of targets)
        {
            const byKey = new Map<string, TranslationRow>();
            for (const language of pkg.translations)
            {
                try
                {
                    const response = await fetch(new URL(`packages/${pkg.path}/files/translations/${language}.json`, this.base || document.baseURI));
                    if (!response.ok) continue;
                    const values = flatten(await response.json());
                    for (const key in values)
                    {
                        let row = byKey.get(key);
                        if (!row)
                        {
                            row = { package: pkg.name, key, values: {} };
                            byKey.set(key, row);
                            rows.push(row);
                        }
                        row.values[language] = values[key];
                    }
                }
                catch { /* a missing file shows as empty cells */ }
            }
        }

        if (run === this.loading) this.rows = rows;
    }

    private handlemode = (e: Event) => {
        this.mode = (e.target as HTMLInputElement).value === "dependencies" ? "dependencies" : "focus";
    }
    private handleadd = (e: Event) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const id = String(new FormData(form).get("language") ?? "").trim();
        if (!id || this.languages.includes(id)) return;
        this.added = [...this.added, id];
        form.reset();
    }
    private handlecell(row: TranslationRow, language: string, e: Event) {
        row.values[language] = (e.target as HTMLInputElement).value;
    }
    private handleexport = () => {
        const languages = this.languages;
        const csv = toCSV([
            ["package", "key", ...languages],
            ...this.rows.map(row => [row.package, row.key, ...languages.map(id => row.values[id] ?? "")]),
        ]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = `${this.entry?.name.replace(/^@/, "").replace(/\//g, "-") ?? "translations"}-${this.mode}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    render() {
        const languages = this.languages;
        const showPackage = this.mode === "dependencies";

        return html`
            <div part="toolbar">
                <fieldset>
                    <legend>${this.t("mode")}</legend>
                    <label><input type="radio" name="mode" value="focus" checked="${this.mode === "focus" ? "true" : ""}" @change="${this.handlemode}" /> ${this.t("focus")}</label>
                    <label><input type="radio" name="mode" value="dependencies" checked="${this.mode === "dependencies" ? "true" : ""}" @change="${this.handlemode}" /> ${this.t("dependencies")}</label>
                </fieldset>
                <form @submit="${this.handleadd}">
                    <label><span>${this.t("language")}</span> <pap-input name="language" aria-label="${this.t("language")}" placeholder="de-DE"></pap-input></label>
                    <pap-button type="submit">${this.t("add")}</pap-button>
                </form>
                <pap-button @click="${this.handleexport}">${this.t("export")}</pap-button>
            </div>
            <div part="scroll">
                <table>
                    <thead>
                        <tr>
                            ${showPackage ? html`<th scope="col">${this.t("package")}</th>` : ""}
                            <th scope="col">${this.t("key")}</th>
                            ${languages.map(id => html`<th scope="col" lang="${id}">${id}</th>`)}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.rows.map(row => html`
                            <tr>
                                ${showPackage ? html`<td>${row.package}</td>` : ""}
                                <th scope="row"><code>${row.key}</code></th>
                                ${languages.map(id => this.added.includes(id)
                                    ? html`<td><input aria-label="${row.key} ${id}" lang="${id}" value="${row.values[id] ?? ""}" @input="${(e: Event) => this.handlecell(row, id, e)}" /></td>`
                                    : html`<td lang="${id}">${row.values[id] ?? ""}</td>`)}
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase-translations": ShowcaseTranslations;
    }
}
