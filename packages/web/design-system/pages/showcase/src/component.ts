// system
import { CustomElement, html, property, bind, query } from "@papit/web-component";

// foundations
import "@papit/icon";
import "@papit/treeview";

// molecules
import "@papit/language-picker";
import "@papit/markdown";
import "@papit/theme-picker";
import "@papit/sidebar";

// tools
import "@papit/router";
import type { Router } from "@papit/router";
import { translate, useTranslator } from "@papit/translator";

// local
import sheet from "./style.css" with { type: "css" };
import { AUTO_PAGES, DOCS, href, pagesOf, resolveRoute } from "./route";
import "./components";
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

    @query({
        selector: "pap-router",
        load(this: Showcase) {
            this.syncRouter();
        }
    }) private routerElement?: Router;
    private routed = new Set<string>();

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
        rerender: true,
        after(this: Showcase) {
            this.handlehashchange();
        }
    }) data?: ShowcaseManifest;

    /** The route the hash resolves to. */
    @property({ type: Object, attribute: false, rerender: true }) route: ShowcaseRoute = {};

    /** The pill menu is pinned open (toggle button); hover and focus open it too. */
    @property({ type: Boolean, attribute: false, rerender: true }) pillopen = false;

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
        if (route.entry === this.route.entry && route.page === this.route.page && route.unknown === this.route.unknown && route.doc === this.route.doc) return;

        this.route = route;
        this.pillopen = false;
        this.syncRouter();
        this.dispatchEvent(new CustomEvent("route", { detail: route }));
    }
    /** Renders, then hands the current package to the auto page (the template has no property bindings). */
    update() {
        super.update();
        const entry = this.route.entry;
        const page = this.shadowRoot?.querySelector<HTMLElement & { entry?: unknown; packages?: unknown }>("pap-showcase-api, pap-showcase-assets, pap-showcase-translations");
        if (page && entry)
        {
            if (page.localName === "pap-showcase-translations") page.packages = this.data?.packages ?? [];
            if (page.entry !== entry) page.entry = entry;
        }
        return undefined;
    }

    /** The route is a view folder of its package, shown by the router. */
    private get isview() {
        const { entry, page } = this.route;
        return !!entry && !!page && entry.views.includes(page);
    }
    /** Registers each package's views route once, then points the router at the current view. */
    private syncRouter() {
        const router = this.routerElement;
        if (!router || !this.data) return;

        for (const entry of this.data.packages)
        {
            if (this.routed.has(entry.path) || entry.views.length === 0) continue;
            this.routed.add(entry.path);
            // the router joins realpath onto the page path, and only fills `:view` from the url
            // when the route declares the param
            router.addRoute({
                url: entry.path + "/:view",
                reroute: [`packages/${entry.path}/view/:view`],
                params: { view: { default: entry.views[0], fallback: [] } },
            });
        }

        if (this.isview)
        {
            const url = `${this.route.entry!.path}/${this.route.page}`;
            if (router.url !== url) router.url = url;
        }
    }

    @bind
    private handleenter(e: Event) {
        if (!(e.target instanceof HTMLElement)) return;
        const link = e.target.querySelector(":scope > a");
        if (link) window.location.hash = link.getAttribute("href") ?? "";
    }

    // render helpers
    /** The sidebar path of the current route: `docs/<path>` for docs, the package path otherwise. */
    private get currentpath() {
        if (this.route.doc) return DOCS + "/" + this.route.doc.replace(/\.md$/, "");
        return this.route.entry?.path;
    }
    private isopen(node: ShowcaseTreeNode, prefix: string) {
        const current = this.currentpath;
        return !!current && current.startsWith(prefix + node.path + "/");
    }
    /** Tree items for packages (`prefix` "") or docs (`prefix` "docs/"). */
    private renderTree(nodes: ShowcaseTreeNode[], prefix = ""): any {
        return nodes.map(node => {
            if (node.package)
            {
                const selected = this.currentpath === prefix + node.path;
                return html`
                    <pap-treeitem @enter="${this.handleenter}" aria-selected="${selected ? "true" : ""}">
                        <a tabindex="-1" href="${href(prefix + node.path)}" aria-current="${selected ? "page" : ""}">${node.name.replace(/\.md$/, "")}</a>
                    </pap-treeitem>
                `;
            }

            return html`
                <pap-treeitem aria-expanded="${this.isopen(node, prefix) ? "true" : "false"}">
                    ${node.name}
                    ${this.renderTree(node.children, prefix)}
                </pap-treeitem>
            `;
        });
    }
    private renderMain() {
        const { entry, page, unknown } = this.route;

        if (unknown) return html`<p part="not-found">${this.t("notfound")} <code>${unknown}</code></p>`;
        if (!this.data) return null;
        if (this.route.doc) return html`<pap-markdown part="readme doc" src="${new URL(`${DOCS}/${this.route.doc}`, this.base).href}"></pap-markdown>`;
        if (!entry)
        {
            if (!this.data.readme) return html`<h1>${this.data.name}</h1>`;
            return html`<pap-markdown part="readme" src="${new URL("README.md", this.base).href}"></pap-markdown>`;
        }

        if (this.isview) return null;
        if (page && !pagesOf(entry).includes(page)) return html`<p part="not-found">${this.t("notfound")} <code>${entry.path}/${page}</code></p>`;

        const heading = html`
            <p part="package-meta">
                <code>${entry.name}</code>
                <span>v${entry.version}</span>
                ${entry.type.map(type => html`<span part="tag">${type}</span>`)}
            </p>
        `;

        if (page === "api") return html`
            <section part="package" aria-label="${entry.name}">${heading}<pap-showcase-api base="${this.base}"></pap-showcase-api></section>
        `;
        if (page === "assets") return html`
            <section part="package" aria-label="${entry.name}">${heading}<pap-showcase-assets base="${this.base}"></pap-showcase-assets></section>
        `;
        if (page === "translations") return html`
            <section part="package" aria-label="${entry.name}">${heading}<pap-showcase-translations base="${this.base}"></pap-showcase-translations></section>
        `;

        return html`
            <section part="package" aria-label="${entry.name}">
                ${heading}
                ${entry.readme
                    ? html`<pap-markdown part="readme" src="${new URL(`packages/${entry.path}/README.md`, this.base).href}"></pap-markdown>`
                    : html`<h1>${entry.name}</h1><p>${entry.description}</p>`}
            </section>
        `;
    }

    /** Pill menu links: the README, then every view and auto page of the current package. */
    private renderPages() {
        const entry = this.route.entry;
        if (!entry) return null;

        const link = (page: string | undefined, label: string) => html`
            <li><a href="${href(entry.path, page)}" aria-current="${this.route.page === page ? "page" : ""}">${label}</a></li>
        `;

        return html`
            <ul id="pages" part="pages" aria-label="${this.t("pill.pages", { name: entry.name })}">
                ${link(undefined, this.t("pill.readme"))}
                ${pagesOf(entry).map(page => link(page, AUTO_PAGES.includes(page as never) ? this.t(`pill.${page}`) : page))}
            </ul>
        `;
    }

    private renderFooter() {
        const data = this.data;
        if (!data) return null;
        return html`
            <span>${data.name} v${data.version}</span>
            ${data.repository ? html`<a href="${data.repository}" rel="noopener noreferrer" target="_blank">${this.t("footer.repository")}</a>` : ""}
            ${data.license ? html`<span>${this.t("footer.license")} ${data.license.replace(/^LicenseRef-/, "")}</span>` : ""}
        `;
    }

    @bind
    private handlepillkeydown(e: KeyboardEvent) {
        if (e.key !== "Escape") return;
        this.pillopen = false;
        // close the hover/focus expansion too: hand focus back to the toggle
        (this.shadowRoot?.querySelector("[part='current']") as HTMLElement | null)?.blur();
    }
    @bind
    private handlepilltoggle() {
        this.pillopen = !this.pillopen;
    }
    @bind
    private handlepillnavigate(e: Event) {
        if ((e.target as Element).closest?.("a")) this.pillopen = false;
    }

    render() {
        const entry = this.route.entry;

        return html`
            <pap-sidebar part="sidebar" open>
                <a slot="header" part="home" href="#/">
                    <pap-icon name="logo"></pap-icon>
                    <strong>${this.data?.name ?? ""}</strong>
                </a>
                ${this.data?.docs?.length ? html`
                    <h2 part="section-title" id="docs-title">${this.t("sidebar.docs")}</h2>
                    <pap-treeview part="docs" aria-labelledby="docs-title">
                        ${this.renderTree(this.data.docs, DOCS + "/")}
                    </pap-treeview>
                    <h2 part="section-title" id="packages-title">${this.t("sidebar.label")}</h2>
                ` : ""}
                <pap-treeview part="packages" aria-label="${this.t("sidebar.label")}">
                    ${this.renderTree(this.data?.tree ?? [])}
                </pap-treeview>
            </pap-sidebar>
            <header part="header">
                <nav
                    part="pill"
                    class="${this.pillopen ? "open" : ""}"
                    aria-label="${this.t("pill.label")}"
                    @keydown="${this.handlepillkeydown}"
                    @click="${this.handlepillnavigate}"
                >
                    <div part="bar">
                        <a part="pill-home" href="#/">${this.data?.name ?? ""}</a>
                        <span part="separator" aria-hidden="true">|</span>
                        ${entry
                            ? html`<button
                                    part="current"
                                    type="button"
                                    aria-expanded="${this.pillopen ? "true" : "false"}"
                                    aria-controls="pages"
                                    @click="${this.handlepilltoggle}"
                                >${entry.name.replace(/^@[^/]+\//, "")}${this.route.page ? html` <small>/ ${this.route.page}</small>` : ""}</button>
                                <span part="separator" aria-hidden="true">|</span>`
                            : ""}
                        <slot name="header">
                            <pap-theme-picker></pap-theme-picker>
                        </slot>
                        <span part="separator" aria-hidden="true">|</span>
                        <slot name="language">
                            <pap-language-picker></pap-language-picker>
                        </slot>
                    </div>
                    ${this.renderPages()}
                </nav>
            </header>
            <main part="main">
                ${this.renderMain()}
                <pap-router part="view" update-url="false" update-title="false" hidden="${this.isview ? "" : "true"}"></pap-router>
            </main>
            <footer part="footer">
                <slot name="footer">${this.renderFooter()}</slot>
            </footer>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase": Showcase;
    }
}
