// import statements 
// system 
import { bind, CustomElementInternals, debounce, html, property, unsafeHTML } from "@papit/web-component";

// foundations 
import "@papit/treeview";

// local 
import sheet from "./style.css" with { type: "css" };

type Link = {
    href: string;
    name: string;
    icon: string | null;
    reference: HTMLElement;
    marked: boolean;
    level: number;
}
interface HierarchicalLink extends Link {
    children: HierarchicalLink[];
}

/**
 * `<pap-table-of-content>` — a scroll-aware table of contents web component.
 *
 * Scans the root node for heading elements (or any element matching {@link query}),
 * assigns stable `id` attributes derived from their text content, and renders them
 * as a hierarchical `<pap-treeview>`. Items corresponding to headings that are
 * currently intersecting the viewport are highlighted with the `marked` CSS class.
 *
 * @fires change - Dispatched whenever the set of visible (intersecting) headings
 *   changes. Read {@link value} inside the handler to get the current active set.
 *
 * @csspart tree   - The root `<pap-treeview>` element.
 * @csspart item   - Each `<pap-treeitem>` element.
 * @csspart anchor - The `<a>` element inside each tree item.
 *
 * @cssprop --space-3 - Inline padding applied to each tree item's content area (default `0.75rem`).
 *
 * @example
 * ```html
 * <pap-table-of-content></pap-table-of-content>
 *
 * <main>
 *   <h1>Intro</h1>
 *   <h2>Details</h2>
 *   <h3>Sub-section</h3>
 * </main>
 * ```
 */
export class TableOfContent extends CustomElementInternals {
    static sheet = sheet;

    /**
     * The currently visible headings as plain objects.
     * Useful for driving external navigation UI or breadcrumbs.
     *
     * @returns An array of `{ href, name }` pairs for every link whose
     *   `marked` flag is `true`.
     */
    get value() {
        return this.links.filter(l => l.marked).map(l => ({ href: l.href, name: l.name }));
    }

    private observer = new IntersectionObserver(this.handleobserve);
    @property({ attribute: false }) links: Link[] = [];
    @property({
        reflect: false,
        after(this: TableOfContent) {
            const root = this.getRootNode();

            const links: Link[] = [];
            if (root instanceof Document || root instanceof ShadowRoot || root instanceof HTMLElement)
            {
                root
                    .querySelectorAll(this.query)
                    .forEach(reference => {
                        if (!(reference instanceof HTMLElement)) return;
                        const name = reference.textContent ?? reference.getAttribute("aria-label");
                        if (!name) return;

                        let level = 0;
                        if (reference.hasAttribute("aria-level"))
                        {
                            level = Number(reference.getAttribute("aria-level"));
                        }
                        else if (reference instanceof HTMLHeadingElement)
                        {
                            const levelMatch = reference.nodeName.match(/H(\d)/i);
                            if (levelMatch)
                            {
                                level = parseInt(levelMatch[1], 10);
                            }
                        }

                        const id = name.toLowerCase().replace(/\s/g, "-");
                        reference.setAttribute("id", id);
                        links.push({
                            reference,
                            href: "#" + id,
                            name,
                            icon: reference.getAttribute("data-icon"),
                            marked: false,
                            level,
                        });



                        this.observer.observe(reference);
                    });
            }

            this.links = links;
            this.requestUpdate();
        }
    }) query = ["[role=\"heading\"]", "h1", "h2", "h3", "h4", "h5", "h6"].map(v => v + ":not([aria-hidden]):not([data-skipped])").join(",");

    @bind
    private handleobserve(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
        entries.forEach(entry => {
            const link = this.links.find(link => link.reference === entry.target);
            if (!link) return;
            link.marked = ('isVisible' in entry ? entry.isVisible as boolean : false) || entry.isIntersecting;
        });
        this.dispatchEvent(new Event("change"));

        this._internals.states.add("scrolling");
        this.stopscrolling(); // debounced
        this.throttleUpdate();
    }

    @bind
    private handleenter(e: Event) {
        if (!(e.target instanceof HTMLElement)) return;
        window.location.hash = e.target.querySelector("a")?.getAttribute("href") ?? "";
    }

    @bind
    private handleactive() {
        this._internals.states.add("active");
    }

    @bind
    private handleinactive() {
        this._internals.states.delete("active");
    }

    @debounce(500)
    private stopscrolling() {
        this._internals.states.delete("scrolling");
    }

    private buildHierarchy(links: Link[]): HierarchicalLink[] {
        const hierarchy: HierarchicalLink[] = [];
        const stack: { item: HierarchicalLink, level: number }[] = [];

        for (const link of links)
        {
            const node: HierarchicalLink = { ...link, children: [] };

            while (stack.length > 0 && stack[stack.length - 1].level >= link.level)
            {
                stack.pop();
            }

            if (stack.length === 0) hierarchy.push(node);
            else stack[stack.length - 1].item.children.push(node);

            stack.push({ item: node, level: link.level });
        }

        return hierarchy;
    }

    private renderTreeItems(items: HierarchicalLink[]): any {
        if (items.length === 0) return null;

        return items.map(item => {
            const hasChildren = item.children.length > 0;
            const isMarked = item.marked;

            if (hasChildren)
            {
                return html`
                    <pap-treeitem part="item" @enter="${this.handleenter}" aria-expanded="true" class="${isMarked ? 'marked' : ''}">
                        <a part="anchor" tabindex="-1" href="${item.href}">
                            ${item.icon && html`<pap-icon name="${item.icon}"></pap-icon>`}
                            ${unsafeHTML(item.name)}
                        </a>
                        ${this.renderTreeItems(item.children)}
                    </pap-treeitem>
                `;
            }
            else
            {
                return html`
                    <pap-treeitem part="item" @enter="${this.handleenter}" aria-expanded="true" class="${isMarked ? 'marked' : ''}">
                        <a part="anchor" tabindex="-1" href="${item.href}">
                            ${item.icon && html`<pap-icon name="${item.icon}"></pap-icon>`}
                            ${unsafeHTML(item.name)}
                        </a>
                    </pap-treeitem>
                `;
            }
        });
    }

    render() {
        const hierarchy = this.buildHierarchy(this.links);

        return html`
            <slot></slot>
            <pap-treeview @active="${this.handleactive}" @inactive="${this.handleinactive}" part="tree">
                ${this.renderTreeItems(hierarchy)}
            </pap-treeview>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-table-of-content": TableOfContent;
    }
}