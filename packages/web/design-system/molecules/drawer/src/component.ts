// import statements 
// system 
import { html, property } from "@papit/web-component";

// atoms 
import { Dialog } from "@papit/dialog";

// local 
import sheet from "./style.css" with { type: "css" };


/**
 * Slide-in drawer panel anchored to any edge. A `static` drawer is a modal overlay (`showModal()`:
 * backdrop, focus trap, Escape); the default drawer is an in-flow, non-modal panel (`show()`).
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
 * @attr {boolean} open - Open state; opens modally when `static` is set
 * @attr {string} label - aria-label for the panel (default: "drawer")
 * @attr {boolean} close-outside-click - Close on backdrop click (default: true)
 * @attr {boolean} static - Modal overlay when true, in-flow non-modal panel when false
 *
 * @fires open - on the host whenever the drawer opens (not on the initial render)
 * @fires close - on the host whenever the drawer closes, including Escape and backdrop click
 *
 * @method show() - Opens drawer, modally when `static` is set
 * @method close() - Closes drawer
 * @method toggle() - Toggles open/closed
 *
 * @csspart panel - The `<dialog>` element. Style backdrop via `::part(panel)::backdrop`
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ WAI-ARIA Dialog (Modal) Pattern}
 */
export class Drawer extends Dialog {
    static sheet = sheet;

    @property placement: "left" | "right" | "top" | "bottom" = "right";
    @property({ rerender: true }) label: string = "drawer";

    @property({
        type: Boolean,
        after(this: Drawer) {
            if (!this.static) this.ismodal = false;
            else this.ismodal = true;
        }
    }) static = false;

    override closeoutsideclick = true;

    // a static drawer is a modal overlay, so show() must not open it non-modally
    public override show() {
        if (this.static) return this.showModal();
        super.show();
    }

    render() {
        return html`
            <dialog
                id="dialog"
                part="panel"
                aria-label="${this.label}"
                @click="${this.handledialogclick}"
                @close="${this.handledialogclose}"
                tabindex="-1"
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