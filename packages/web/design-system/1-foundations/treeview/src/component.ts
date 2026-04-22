// import statements
// system
import { bind, CustomElement, debounce, html, property } from "@papit/web-component";

// local
import sheet from "./style.css" assert { type: "css" };
import { Treeitem } from "components/treeitem";

/**
 * A hierarchical tree widget that allows users to navigate and select items
 * from a nested collection using keyboard and mouse.
 *
 * Implements the WAI-ARIA tree pattern with full keyboard navigation,
 * single and multi-select modes, and typeahead search.
 *
 * @element pap-treeview
 *
 * @slot - Accepts elements with `role="treeitem"`. Nest expandable branches
 * by placing a `<ul role="group">` inside a treeitem. Set `aria-expanded="true"`
 * on a treeitem to have it open on initial render; omit the attribute or set it
 * to `"false"` to start collapsed.
 *
 * @attr {boolean} strict - When true, only children with `role="treeitem"` are
 * registered. When false (default), all direct children of a group are registered.
 *
 * @attr {"single"|"multiple"} mode - Selection mode. In `"single"` mode only one
 * item can be selected at a time. In `"multiple"` mode multiple items can be
 * selected independently. Defaults to `"single"`.
 *
 * @attr {"horizontal"|"vertical"} aria-orientation - Orientation of the tree.
 * Defaults to `"vertical"` per the ARIA spec.
 *
 * @example
 * ```html
 * <pap-treeview aria-label="File explorer">
 *   <li role="treeitem">README.md</li>
 *   <li role="treeitem" aria-expanded="false">
 *     <span>src</span>
 *     <ul role="group">
 *       <li role="treeitem">index.ts</li>
 *       <li role="treeitem">style.css</li>
 *     </ul>
 *   </li>
 * </pap-treeview>
 * ```
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role ARIA: tree role}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/treeitem_role ARIA: treeitem role}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/group_role ARIA: group role}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/treeview/ APG: Tree View Pattern}
 */
export class Treeview extends CustomElement {
    static sheet = sheet;

    /**
     * When true, only elements explicitly marked with `role="treeitem"` are
     * registered as navigable nodes. Useful when slotted markup contains
     * non-item elements inside groups.
     */
    @property({ type: Boolean }) strict = false;

    /**
     * Controls whether the tree is single- or multi-select.
     *
     * - `"single"` — only one item carries `aria-selected="true"` at a time.
     * - `"multiple"` — sets `aria-multiselectable="true"` on the root; Space
     *   toggles each item's selected state independently.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-multiselectable aria-multiselectable}
     */
    @property({
        after(this: Treeview) {
            if (this.mode === "single") this.removeAttribute("aria-multiselectable");
            else this.setAttribute("aria-multiselectable", "true");
        }
    }) mode: "single" | "multiple" = "single";

    /**
     * Reflects the tree's orientation. Defaults to `"vertical"` per the ARIA spec.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-orientation aria-orientation}
     */
    @property({ attribute: "aria-orientation" }) orientation: "horizontal" | "vertical" = "vertical";

    /** Flat ordered list of all registered treeitem elements, including nested ones. */
    private nodes: HTMLElement[] = [];

    /** Accumulated typeahead characters, cleared after debounce. */
    private query = "";

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "tree");
        this.tabIndex = 0;
        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("click", this.handleclick);
        this.addEventListener("focusin", this.handlefocusin);
        this.addEventListener("focusout", this.handlefocusout);
    }

    @bind
    private handlefocusin(e: FocusEvent) {
        if (e.target !== this) return;
        const from = e.relatedTarget as Node | null;
        // coming from inside = shift-tabbing out, don't redirect
        if (from && this.contains(from))
        {
            this.tabIndex = 0; // restore so browser continues past host
            return;
        }
        this.tabIndex = -1;
        const active = this.getFocus();
        if (active !== -1)
        {
            this.nodes[active].focus();
        } else
        {
            const first = this.nextVisible(-1);
            if (first !== null)
            {
                this.nodes[first].tabIndex = 0;
                this.nodes[first].focus();
            }
        }
    }

    @bind
    private handlefocusout(e: FocusEvent) {
        if (!this.contains(e.relatedTarget as Node))
        {
            this.tabIndex = 0;
        }
    }

    // -------------------------------------------------------------------------
    // dom helpers

    /**
     * Returns the index of the currently focused node by reading `tabIndex === 0`
     * from the DOM, making the DOM the single source of truth rather than a
     * separate tracked integer.
     */
    private getFocus(): number {
        return this.nodes.findIndex(n => n.tabIndex === 0);
    }

    /**
     * Determines whether a treeitem is currently reachable by keyboard navigation.
     * A node is hidden if any ancestor `role="group"` has an owning treeitem
     * with `aria-expanded` set to anything other than `"true"`.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded aria-expanded}
     */
    private isVisible(element: HTMLElement): boolean {
        let node: HTMLElement | null = element.parentElement;
        while (node && node !== this)
        {
            if (node instanceof Treeitem)
            {
                if (node.getAttribute("aria-expanded") !== "true") return false;
            } else if (node.getAttribute("role") === "group")
            {
                const owner = node.parentElement;
                if (!(owner instanceof HTMLElement)) return false;
                if (owner.getAttribute("aria-expanded") !== "true") return false;
            }
            node = node.parentElement;
        }
        return true;
    }

    /**
     * Returns true if the treeitem is currently expanded.
     * `aria-expanded` lives on the treeitem per the ARIA spec, not on the group.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded aria-expanded}
     */
    private isExpanded(element: HTMLElement): boolean {
        return element.getAttribute("aria-expanded") === "true";
    }

    /** Returns true if this treeitem has a direct child `role="group"`. */
    private isExpandable(element: HTMLElement): boolean {
        if (element instanceof Treeitem)
            return Array.from(element.children).some(c => c instanceof Treeitem);
        return !!element.querySelector(":scope > [role='group']");
    }

    private expand(element: HTMLElement) {
        element.setAttribute("aria-expanded", "true");
        if (!(element instanceof Treeitem))
        {
            const group = element.querySelector<HTMLElement>(":scope > [role='group']");
            if (group) group.style.display = "block";
        }
        // Treeitem handles display via CSS :host([aria-expanded="true"]) div[part="group"]
    }

    private collapse(element: HTMLElement) {
        element.setAttribute("aria-expanded", "false");
        if (!(element instanceof Treeitem))
        {
            const group = element.querySelector<HTMLElement>(":scope > [role='group']");
            if (group) group.style.display = "none";
        }
    }

    /**
     * Walks up the DOM to find the nearest ancestor treeitem (i.e. the parent
     * branch of the given node), used for ArrowLeft navigation.
     */
    private findParent(element: HTMLElement): HTMLElement | null {
        if (element instanceof Treeitem)
        {
            const parent = element.parentElement;
            return parent instanceof Treeitem ? parent : null;
        }
        const group = element.parentElement?.closest("[role='group']");
        if (!group) return null;
        const parent = group.parentElement;
        return parent instanceof HTMLElement ? parent : null;
    }

    // -------------------------------------------------------------------------
    // focus

    /**
     * Moves focus to the node at the given index using roving tabindex.
     * The previously focused node is reset to `tabIndex = -1`.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Keyboard-navigable_JavaScript_widgets#managing_focus_inside_components Roving tabindex}
     */
    // private setFocus(index: number) {
    //     const prev = this.getFocus();
    //     if (prev !== -1) this.nodes[prev].tabIndex = -1;
    //     // this.tabIndex = -1; // host steps aside once a node is active
    //     this.nodes[index].tabIndex = 0;
    //     this.nodes[index].focus();
    // }

    private setFocus(index: number) {
        const prev = this.getFocus();
        if (prev !== -1) this.nodes[prev].tabIndex = -1;
        this.tabIndex = -1; // step aside while navigating
        this.nodes[index].tabIndex = 0;
        this.nodes[index].focus();
    }

    /** Returns the index of the next visible node after `from`, or null if none. */
    private nextVisible(from: number): number | null {
        for (let i = from + 1; i < this.nodes.length; i++)
        {
            if (this.isVisible(this.nodes[i])) return i;
        }
        return null;
    }

    /** Returns the index of the previous visible node before `from`, or null if none. */
    private prevVisible(from: number): number | null {
        for (let i = from - 1; i >= 0; i--)
        {
            if (this.isVisible(this.nodes[i])) return i;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // selection

    /**
     * Selects the node at the given index.
     *
     * In `"single"` mode, clears all other selections first.
     * In `"multiple"` mode, toggles the node's selected state.
     * Does not set `aria-selected="false"` on unselected nodes — the attribute
     * is simply absent, per the single-select ARIA spec.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-selected aria-selected}
     */
    private select(index: number) {
        if (this.mode === "single")
        {
            this.nodes.forEach(n => n.removeAttribute("aria-selected"));
            this.nodes[index].setAttribute("aria-selected", "true");
        } else
        {
            const el = this.nodes[index];
            if (el.getAttribute("aria-selected") === "true") el.removeAttribute("aria-selected");
            else el.setAttribute("aria-selected", "true");
        }
        // this.currentactive = index;
    }

    // -------------------------------------------------------------------------
    // handlers

    /**
     * Keyboard interaction per the ARIA tree pattern:
     *
     * - ArrowDown / ArrowUp — move focus to next/previous visible node
     * - ArrowRight — expand closed branch, or move into open branch
     * - ArrowLeft — collapse open branch, or move focus to parent
     * - Home / End — jump to first/last visible node
     * - Enter — toggle expand on branches; select on leaf nodes
     * - Space — toggle selection (multi-select) or select (single)
     * - Printable characters — typeahead search
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role#keyboard_interactions Keyboard interactions}
     */
    @bind
    private handlekeydown(e: KeyboardEvent) {
        const focus = this.getFocus();

        if (/ArrowUp/i.test(e.key))
        {
            if (focus === -1) return;
            const prev = this.prevVisible(focus);
            if (prev !== null) this.setFocus(prev);
            // else
            // {
            //     this.nodes[focus].tabIndex = -1;
            //     this.tabIndex = 0;
            //     this.focus();
            // }
        }
        else if (/ArrowDown/i.test(e.key))
        {
            const next = this.nextVisible(focus);
            if (next !== null) this.setFocus(next);
        }
        else if (/ArrowLeft/i.test(e.key))
        {
            if (focus === -1) return;
            const el = this.nodes[focus];
            if (this.isExpandable(el) && this.isExpanded(el))
            {
                this.collapse(el);
            } else
            {
                const parent = this.findParent(el);
                if (parent)
                {
                    const pi = this.nodes.indexOf(parent);
                    if (pi !== -1) this.setFocus(pi);
                }
            }
        }
        else if (/ArrowRight/i.test(e.key))
        {
            if (focus === -1) return;
            const el = this.nodes[focus];
            if (!this.isExpandable(el)) return;
            if (!this.isExpanded(el)) this.expand(el);
            else
            {
                const next = this.nextVisible(focus);
                if (next !== null) this.setFocus(next);
            }
        }
        else if (/Home/i.test(e.key))
        {
            const first = this.nextVisible(-1);
            if (first !== null) this.setFocus(first);
        }
        else if (/End/i.test(e.key))
        {
            const last = this.prevVisible(this.nodes.length);
            if (last !== null) this.setFocus(last);
        }
        else if (/Enter/i.test(e.key))
        {
            if (focus === -1) return;
            const el = this.nodes[focus];
            if (this.isExpandable(el))
            {
                if (this.isExpanded(el)) this.collapse(el);
                else this.expand(el);
            } else
            {
                this.select(focus);
            }
        }
        else if (/ /.test(e.key))
        {
            if (focus !== -1) this.select(focus);
        }
        else
        {
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey)
            {
                this.query += e.key;
                this.search();
            }

            return; // don't preventDefault — browser shortcuts should still work
        }

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Handles mouse clicks on treeitem elements. Uses `closest` to handle clicks
     * on child elements (icons, spans) inside a treeitem.
     *
     * Clicking a branch toggles its expanded state.
     * Clicking a leaf selects it.
     */
    @bind
    private handleclick(e: MouseEvent) {
        const target = (e.target as HTMLElement).closest<HTMLElement>("[role='treeitem']");
        if (!target) return;
        const index = this.nodes.indexOf(target);
        if (index === -1) return;

        this.setFocus(index);

        if (this.isExpandable(target))
        {
            if (this.isExpanded(target)) this.collapse(target);
            else this.expand(target);
        } else
        {
            this.select(index);
        }
    }

    /**
     * Rebuilds the flat `nodes` list whenever slotted content changes.
     * Recursively processes nested groups via `handleElement`.
     */
    @bind
    private handleslotchange(e: Event) {
        if (!(e.target instanceof HTMLSlotElement)) return;
        this.nodes = [];
        e.target
            .assignedElements({ flatten: true })
            .forEach(el => { if (el instanceof HTMLElement) this.handleElement(el); });

        // first visible node is the tab entry point
        const first = this.nextVisible(-1);
        if (first !== null) this.nodes[first].tabIndex = 0
    }

    /**
     * Registers a single element as a treeitem node and recurses into any
     * direct child `role="group"` to register nested treeitems.
     *
     * - Sets `role="treeitem"` if not already present (unless `strict` mode is on)
     * - Initialises `aria-expanded` on branch nodes (defaulting to `"false"`)
     * - Sets the group's initial display to match the treeitem's expanded state
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/treeitem_role ARIA: treeitem role}
     */
    private handleElement(element: HTMLElement) {
        if (this.strict && element.getAttribute("role") !== "treeitem") return;

        this.nodes.push(element);
        element.tabIndex = -1;
        element.setAttribute("role", "treeitem");

        const children = element instanceof Treeitem
            ? Array.from(element.children).filter(c => c instanceof Treeitem)
            : Array.from(element.children).filter(c => c.getAttribute("role") === "group")
                .flatMap(g => {
                    const group = g as HTMLElement;
                    // restore initial display state for plain HTML groups
                    group.style.display = element.getAttribute("aria-expanded") === "true" ? "block" : "none";
                    return Array.from(group.children);
                });

        if (children.length > 0)
        {
            if (!element.hasAttribute("aria-expanded"))
                element.setAttribute("aria-expanded", "false");
        }

        for (const child of children)
        {
            if (child instanceof HTMLElement) this.handleElement(child);
        }
    }

    // -------------------------------------------------------------------------
    // search

    private getLabel(node: HTMLElement): string {
        if (node instanceof Treeitem)
        {
            // only direct text nodes, not descendants
            return Array.from(node.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE)
                .map(n => n.textContent ?? "")
                .join("")
                .trim()
                .toLowerCase();
        }
        return (node.textContent ?? "").trim().toLowerCase();
    }
    /**
     * Typeahead search: moves focus to the next visible node whose text content
     * starts with the accumulated query string. Wraps around from the current
     * position. The query is cleared after the debounce delay.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role#keyboard_interactions Type-ahead}
     */
    @debounce
    private search() {
        const q = this.query.toLowerCase();
        this.query = "";

        const focus = this.getFocus();
        const start = focus === -1 ? -1 : focus;
        const indices = [
            ...this.nodes.slice(start + 1).map((_, i) => start + 1 + i),
            ...this.nodes.slice(0, start + 1).map((_, i) => i),
        ];

        const match = indices.find(i =>
            this.isVisible(this.nodes[i]) &&
            this.getLabel(this.nodes[i]).startsWith(q)
        );

        if (match !== undefined) this.setFocus(match);
    }

    // -------------------------------------------------------------------------

    render() {
        return html`
            <slot @slotchange="${this.handleslotchange}"></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-treeview": Treeview;
    }
}