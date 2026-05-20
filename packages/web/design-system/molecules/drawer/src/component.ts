// import statements 
// system 
import { html, property } from "@papit/web-component";

// atoms 
import { Dialog } from "@papit/dialog";

// local 
import sheet from "./style.css" assert { type: "css" };


/**
 * Slide-in drawer panel anchored to any edge. Built on native `<dialog>` with `showModal()`.
 *
 * @example
 * ```html
 * <button commandfor="my-drawer" command="toggle">Open</button>
 * <pap-drawer id="my-drawer" placement="right">
 *   <p>Content</p>
 *   <button commandfor="my-drawer" command="close">Close</button>
 * </pap-drawer>
 * ```
 *
 * @slot - Main drawer content
 *
 * @attr {string} placement - Edge to slide from: "left"|"right"|"top"|"bottom" (default: "right")
 * @attr {boolean} open - Open state
 * @attr {string} label - aria-label for the panel (default: "drawer")
 * @attr {boolean} close-outside-click - Close on backdrop click (default: true)
 * @attr {boolean} static - When true, uses fixed positioning (modal overlay)
 *
 * @method show() - Opens drawer via showModal()
 * @method close() - Closes drawer
 * @method toggle() - Toggles open/closed
 *
 * @csspart panel - The `<dialog>` element. Style backdrop via `::part(panel)::backdrop`
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ WAI-ARIA Dialog (Modal) Pattern}
 */
export class Drawer extends Dialog {
    static sheet = sheet;

    @property({ rerender: true })
    placement: "left" | "right" | "top" | "bottom" = "right";

    @property({
        type: Boolean,
        after(this: Drawer) {
            if (!this.static) this.ismodal = false;
        }
    }) static = false;

    override closeoutsideclick = true;
    override ismodal = false;

    render() {
        return html`
            <dialog
                id="dialog"
                part="panel"
                @click="${this.handledialogclick}"
                @close="${this.handledialogclose}"
            >
                <div class="wrap">
                    <slot></slot>
                </div>
            </dialog>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-drawer": Drawer;
    }
}