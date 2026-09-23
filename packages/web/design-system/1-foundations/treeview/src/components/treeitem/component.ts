import { bind, CustomElement, debounce, html, property, query } from "@papit/web-component";

import "@papit/icon";

import sheet from "./style.css" with { type: "css" };

/**
 * Item for `pap-treeview`. Nested `pap-treeitem`s become its children and get
 * a caret icon; the tree manages role, focus, expansion and selection.
 *
 * @element pap-treeitem
 * @slot - the label; nested treeitems are moved to `group`
 * @slot group - child items
 * @csspart content - the row with caret and label
 * @csspart group - the `role="group"` wrapper of child items
 * @cssprop [--depth=0rem] - left padding of the row, grows per level
 */
export class Treeitem extends CustomElement {
    static sheet = sheet;

    private haschildren = false;

    @bind
    private handleslotchange(e: Event) {
        if (!(e.target instanceof HTMLSlotElement)) return;

        e.target.assignedNodes({ flatten: true }).forEach(node => {
            if (node instanceof Treeitem || node instanceof HTMLElement && node.getAttribute("role") === "treeitem") 
            {
                node.slot = "group";
                this.haschildren = true;
            }
        });

        this.requestUpdate();
    }

    render() {
        return html`
            <div part="content">
                ${this.haschildren && html`<pap-icon name="caret-down"></pap-icon>`}
                <slot @slotchange="${this.handleslotchange}"></slot>
            </div>
            <div role="group" part="group">
                <slot name="group"></slot>
            </div>
        `;
    }
}