// import statements 
// system 
import { CustomElement, html, query } from "@papit/web-component";
// local 
import sheet from "./style.css" assert { type: "css" };
import "@papit/group";
import { Group } from "@papit/group";

import { MenuItem } from "components/menuitem";
import { Menu } from "component";

export class MenuBar extends CustomElement {
    static sheet = sheet;

    @query("pap-group") private groupElement!: Group;

    private itemElements: MenuItem[] = [];

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "menubar");
        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("menuitem:next", this.handlemenugotonext);
        this.addEventListener("menuitem:prev", this.handlemenugotonext);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("keydown", this.handlekeydown);
        this.removeEventListener("menuitem:next", this.handlemenugotonext);
        this.removeEventListener("menuitem:prev", this.handlemenugotonext);
    }

    private get activeItem(): MenuItem | undefined {
        return this.itemElements.find(el => el === document.activeElement);
    }

    private get activeItemHasOpenSubmenu(): boolean {
        return this.activeItem?.getAttribute("aria-expanded") === "true";
    }

    // event handlers
    private handleslotchange = (e: Event) => {
        if (!(e.target instanceof HTMLSlotElement)) return;
        this.itemElements = e.target
            .assignedElements({ flatten: true })
            .filter((el): el is MenuItem => el instanceof MenuItem);

        // stamp so menuitem knows it's in a menubar context
        this.itemElements.forEach(el => el.setAttribute("data-in-menubar", ""));
    }

    private handlekeydown = (e: KeyboardEvent) => {
        // ArrowDown on a top-level item opens its submenu
        if (/ArrowDown/i.test(e.key))
        {
            const item = this.activeItem;
            if (item?.submenu)
            {
                e.preventDefault();
                e.stopPropagation();
                item.submenu.showPopover();
            }
        }

        // ArrowUp on a top-level item opens submenu and focuses last item
        if (/ArrowUp/i.test(e.key))
        {
            const item = this.activeItem;
            if (item?.submenu)
            {
                e.preventDefault();
                e.stopPropagation();
                item.submenu.showPopover();
                if (item.submenu instanceof Menu) item.submenu.focusLast();
            }
        }
    }

    // when a leaf item inside an open submenu fires menuitem:next/prev,
    // close current submenu and move to next/prev menubar item
    private handlemenugotonext = (e: Event) => {
        if (!(e instanceof CustomEvent)) return;
        e.stopPropagation();

        const wasOpen = this.activeItemHasOpenSubmenu;
        this.activeItem?.submenu?.hidePopover();

        if (e.type === "menuitem:next") this.groupElement.next();
        else this.groupElement.prev();

        // if a submenu was open, open the next item's submenu too
        if (wasOpen)
        {
            this.activeItem?.submenu?.showPopover();
        }
    }

    render() {
        return html`
            <pap-group 
                aria-orientation="horizontal"
                part="group"
            >
                <slot @slotchange="${this.handleslotchange}"></slot>
            </pap-group>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-menubar": MenuBar;
    }
}