// system
import { CustomElement, html, property, bind } from "@papit/web-component";

// foundations
import "@papit/icon";
import "@papit/treeview";

// molecules
import "@papit/theme-picker";
import "@papit/sidebar";

// tools
import { translate, useTranslator } from "@papit/translator";

// local
import sheet from "./style.css" with { type: "css" };
import { href, resolveRoute } from "./route";
import type { ShowcaseManifest, ShowcaseRoute, ShowcaseTreeNode } from "./types";

/**
 * Showcase site shell: a sidebar tree of every package from a `manifest.json`, routed by the url hash
 * (`#/<package path>/<page>`).
 *
 * @element pap-showcase
 * @fires load - when the manifest has loaded
 * @fires route - when the hash resolves to a new route; `detail` is the route
 * @slot header - replaces the default header content (theme picker)
 * @slot footer - footer content
 */
export class Showcase extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator();

    /** URL of the manifest; package files resolve against it. */
    @property({
        rerender: false,
        after(this: Showcase) {
            this.load();
        }
    }) manifest = "manifest.json";

    /** The loaded manifest, can also be set directly. */
    @property({
        type: Object,
        attribute: false,
        after(this: Showcase) {
            this.handlehashchange();
        }
    }) data?: ShowcaseManifest;

    /** The route the hash resolves to. */
    @property({ type: Object, attribute: false }) route: ShowcaseRoute = {};

    /** Base URL of the site, the folder holding the manifest. */
    get base() {
        return new URL(".", new URL(this.manifest, document.baseURI)).href;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("hashchange", this.handlehashchange);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("hashchange", this.handlehashchange);
    }

    private async load() {
        try
        {
            const response = await fetch(new URL(this.manifest, document.baseURI));
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            this.data = await response.json();
            this.dispatchEvent(new Event("load"));
        }
        catch (error)
        {
            console.error("[pap-showcase] could not load manifest", this.manifest, error);
        }
    }

    // event handlers
    @bind
    private handlehashchange() {
        const route = resolveRoute(window.location.hash, this.data);
        if (route.entry === this.route.entry && route.page === this.route.page && route.unknown === this.route.unknown) return;

        this.route = route;
        this.dispatchEvent(new CustomEvent("route", { detail: route }));
    }
    @bind
    private handleenter(e: Event) {
        if (!(e.target instanceof HTMLElement)) return;
        const link = e.target.querySelector(":scope > a");
        if (link) window.location.hash = link.getAttribute("href") ?? "";
    }

    // render helpers
    private isopen(node: ShowcaseTreeNode) {
        const current = this.route.entry?.path;
        return !!current && current.startsWith(node.path + "/");
    }
    private renderTree(nodes: ShowcaseTreeNode[]): any {
        return nodes.map(node => {
            if (node.package)
            {
                const selected = this.route.entry?.path === node.path;
                return html`
                    <pap-treeitem @enter="${this.handleenter}" aria-selected="${selected ? "true" : ""}">
                        <a tabindex="-1" href="${href(node.path)}" aria-current="${selected ? "page" : ""}">${node.name}</a>
                    </pap-treeitem>
                `;
            }

            return html`
                <pap-treeitem aria-expanded="${this.isopen(node) ? "true" : "false"}">
                    ${node.name}
                    ${this.renderTree(node.children)}
                </pap-treeitem>
            `;
        });
    }
    private renderMain() {
        const { entry, page, unknown } = this.route;

        if (unknown) return html`<p part="not-found">${this.t("notfound")} <code>${unknown}</code></p>`;
        if (!entry) return html`<h1>${this.data?.name ?? ""}</h1>`;

        return html`
            <h1>${entry.name}</h1>
            <p>${entry.description}</p>
            ${page && html`<p>${page}</p>`}
        `;
    }

    render() {
        return html`
            <pap-sidebar part="sidebar" open>
                <a slot="header" part="home" href="#/">
                    <pap-icon name="logo"></pap-icon>
                    <strong>${this.data?.name ?? ""}</strong>
                </a>
                <pap-treeview aria-label="${this.t("sidebar.label")}">
                    ${this.renderTree(this.data?.tree ?? [])}
                </pap-treeview>
            </pap-sidebar>
            <header part="header">
                <slot name="header">
                    <pap-theme-picker></pap-theme-picker>
                </slot>
            </header>
            <main part="main">
                ${this.renderMain()}
            </main>
            <footer part="footer">
                <slot name="footer"></slot>
            </footer>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase": Showcase;
    }
}
