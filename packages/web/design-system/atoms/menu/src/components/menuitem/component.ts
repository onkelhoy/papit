// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };
import { Placement } from "@papit/placement";
import { Menu } from "component";

/**
 * A single item within a `pap-menu` or `pap-menubar`, representing a choice,
 * action, or submenu trigger. Supports all three ARIA menuitem roles:
 * `menuitem`, `menuitemcheckbox`, and `menuitemradio`.
 *
 * When a `pap-menu` is slotted as a child, the item automatically upgrades
 * into a submenu trigger — wiring up `aria-haspopup`, `aria-expanded`, and
 * anchor positioning without any additional attributes required.
 *
 * Keyboard interaction follows the WAI-ARIA menu pattern:
 * - `ArrowRight` — opens the submenu if present
 * - `ArrowLeft` — closes the submenu and returns focus to this item
 * - `Enter` / `Space` — opens submenu, or activates and dispatches `click` on leaf items
 *
 * @element pap-menuitem
 *
 * @slot - Label content. If a `pap-menu` is slotted here it is detected
 *         automatically and treated as a submenu.
 *
 * @attr {"menuitem"|"menuitemcheckbox"|"menuitemradio"} role - ARIA role (default: menuitem)
 * @attr {string} placement - Submenu placement relative to this item (default: right-top)
 *
 * @example Leaf item:
 * ```html
 * <pap-menuitem>Cut</pap-menuitem>
 * ```
 *
 * @example Submenu trigger:
 * ```html
 * <pap-menuitem>
 *   Open Recent
 *   <pap-menu>
 *     <pap-menuitem>project-one.txt</pap-menuitem>
 *     <pap-menuitem>project-two.txt</pap-menuitem>
 *   </pap-menu>
 * </pap-menuitem>
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ WAI-ARIA Menu and Menubar Pattern}
 */
export class MenuItem extends CustomElement {
    static sheet = sheet;

    constructor() {
        super();
        this.tabIndex = 0;
    }

    // @property role: "menuitem" | "menuitemcheckbox" | "menuitemradio" = "menuitem";

    @property({
        after(this: MenuItem, value) {
            if (!this.submenu) return;

            if (this.placement)
            {
                this.submenu.setAttribute("placement", this.placement)
            }
            else 
            {
                this.submenu.removeAttribute("placement");
            }
        }
    }) placement?: Placement['placement'];
    public submenu?: HTMLElement;


    connectedCallback(): void {
        super.connectedCallback();
        const role = this.getAttribute("role");
        if (!role || !["menuitem", "menuitemcheckbox", "menuitemradio"].includes(role)) this.setAttribute("role", "menuitem");

        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("click", this.handleclick);
    }

    // event handlers 
    private handleslotchange = (e: Event) => {
        if (!(e.target instanceof HTMLSlotElement)) return;

        e.target.assignedElements({ flatten: true }).forEach(element => {
            if (!(element instanceof HTMLElement)) return;

            if (element.getAttribute("role") === "menu")
            {
                this.submenu = element;
                element.setAttribute("placement", this.placement ?? "right-top");

                if (element instanceof Menu) element.registerTrigger(this);

                this.setAttribute("aria-haspopup", "menu");
                this.setAttribute("aria-expanded", "false");
            }
        });
    }

    private handleclick = () => {
        if (this.submenu)
        {
            // submenu trigger — open it, same as ArrowRight
            this.submenu.showPopover();
        }
    }

    private handlekeydown = (e: KeyboardEvent) => {
        if (/ArrowRight/i.test(e.key) && this.submenu)
        {
            e.preventDefault();
            e.stopPropagation();
            this.submenu.showPopover();
            return;
        }

        if (/ArrowLeft/i.test(e.key) && this.submenu?.matches(":popover-open"))
        {
            e.preventDefault();
            e.stopPropagation();
            this.submenu.hidePopover();
            this.focus();
            return;
        }

        if (/Enter| /.test(e.key))
        {
            e.preventDefault();
            if (this.submenu)
            {
                // submenu trigger — open it, same as ArrowRight
                this.submenu.showPopover();
            }
            else
            {
                // leaf item — dispatch click so consumers can listen normally
                this.dispatchEvent(new Event("click"));
            }
        }
    }

    render() {
        return html`
            <slot @slotchange="${this.handleslotchange}"></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-menuitem": MenuItem;
    }
}