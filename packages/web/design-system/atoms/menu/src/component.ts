// import statements 
// system 
import { generateUUID, html, property, query } from "@papit/web-component";

// foundations
import { Placement } from "@papit/placement";

// local 
import sheet from "./style.css" assert { type: "css" };
import "@papit/group";
import { Group } from "@papit/group";

/**
 * A menu component that presents a list of choices to the user,
 * such as actions or functions. Behaves like native OS menus — opened
 * by activating a trigger element, choosing an item that opens a submenu,
 * or via a keyboard command. When a user activates a choice, the menu
 * closes unless the choice opened a submenu.
 *
 * Internally uses the Popover API for display and anchor-based positioning.
 * Manages focus delegation, trigger wiring, and return focus on close.
 * When opened, focus is automatically moved to the first item.
 * When closed, focus returns to the trigger element.
 *
 * Can be used standalone (triggered by any element with a matching
 * `popovertarget` attribute) or as a submenu inside a `pap-menuitem`.
 * Submenus are discovered and registered automatically via `registerTrigger`.
 *
 * @element pap-menu
 *
 * @slot - `pap-menuitem`, `pap-menuitemcheckbox`, or `pap-menuitemradio` elements
 *
 * @attr {boolean} data-loop - Whether keyboard navigation wraps around at the ends (default: false)
 *
 * @example Standalone menu triggered by a native button:
 * ```html
 * <button popovertarget="my-menu">Options</button>
 * <pap-menu id="my-menu">
 *   <pap-menuitem>Cut</pap-menuitem>
 *   <pap-menuitem>Copy</pap-menuitem>
 *   <pap-menuitem>Paste</pap-menuitem>
 * </pap-menu>
 * ```
 *
 * @example Nested submenu (registered automatically by pap-menuitem):
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
export class Menu extends Placement {
    static sheet = sheet;

    @query("pap-group") private groupElement!: Group;
    @property({ rerender: true, type: Boolean, attribute: "data-loop" }) loop = false;

    private triggerElement: HTMLElement | null = null;
    private itemElements: HTMLElement[] = [];
    private previousFocusedElement: Element | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "menu");

        // lets find our dear trigger

        if (!this.id) this.id = generateUUID();
        if (!this.hasAttribute("popover")) this.setAttribute("popover", "auto");

        this.addEventListener("toggle", this.handletoggle);

        this.style.setProperty("--anchor-name", `--anchor-${this.id}`);
        this.style.setProperty("position-anchor", `--anchor-${this.id}`);

        const closestPopoverTrigger = this.shadowQuery<HTMLElement>(`[popovertarget="${this.id}"]`);
        if (closestPopoverTrigger) return this.registerTrigger(closestPopoverTrigger);

        // no trigger - so we are a spooky menu
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("toggle", this.handletoggle);
    }

    public registerTrigger(element: HTMLElement) {

        this.triggerElement = element;

        element.setAttribute("aria-expanded", "false");
        element.setAttribute("popovertarget", this.id);
        element.style.setProperty('anchor-name', `--anchor-${this.id}`);

        // label the menu by its trigger
        if (!element.id) element.id = generateUUID();
        this.setAttribute("aria-labelledby", element.id);
    }

    public focusLast() {
        this.groupElement.last();
    }

    // event handlers 
    private handlegroupfocusout = (e: FocusEvent) => {
        if (this.contains(e.relatedTarget as Node)) return;
        if (this.matches(":popover-open"))
        {
            if (this.triggerElement) this.triggerElement.focus();
            else if (this.previousFocusedElement instanceof HTMLElement) this.previousFocusedElement.focus();
            this.hidePopover();
        }
    }

    private handletoggle = (e: Event) => {
        if (!(e instanceof ToggleEvent)) return;

        if (e.newState === "open")
        {
            this.previousFocusedElement = document.activeElement;
            requestAnimationFrame(() => {
                this.groupElement.first();
            });
            this.dispatchEvent(new Event("open"));
        }
        else 
        {
            this.dispatchEvent(new Event("close"));
        }

        if (this.triggerElement)
        {
            this.triggerElement.setAttribute("aria-expanded", e.newState === "open" ? "true" : "false");
        }
    }

    private handleslotchange = (e: Event) => {
        if (!(e.target instanceof HTMLSlotElement)) return;

        const elements = e.target.assignedElements({ flatten: true });
        // we are looking for items so we can determine who is the first etc 
        this.itemElements = elements.filter(element => element instanceof HTMLElement && element.role && ["menuitem", "menuitemcheckbox", "menuitemradio", "menu"].includes(element.role)) as HTMLElement[];
    }

    render() {
        return html`
            <pap-group 
                aria-orientation="vertical" 
                part="group"
                loop="${this.loop}"
                @focusout="${this.handlegroupfocusout}"
            >
                <slot @slotchange="${this.handleslotchange}"></slot>
            </pap-group>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-menu": Menu;
    }
}