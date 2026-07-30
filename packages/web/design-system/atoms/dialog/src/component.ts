// import statements 
// system 
import { bind, CustomElement, html, property, query } from "@papit/web-component";

// foundations 
import "@papit/icon";

// local 
import sheet from "./style.css" with { type: "css" };
import { FOCUSABLE } from "types";

/**
 * Wrapper around native `<dialog>` with slots, close button, and backdrop click support.
 *
 * @example
 * ```html
 * <button commandfor="my-dialog" command="show-modal">Open</button>
 * <pap-dialog id="my-dialog" header="Confirm">
 *   <p>Are you sure?</p>
 *   <div slot="footer">
 *     <button commandfor="my-dialog" command="close">Cancel</button>
 *     <button>Confirm</button>
 *   </div>
 * </pap-dialog>
 * ```
 *
 * @slot - Main content
 * @slot header - Replaces header text
 * @slot footer - Action buttons (hidden when empty)
 *
 * @attr {string} header - Dialog title
 * @attr {boolean} open - Open state
 * @attr {boolean} close-outside-click - Close on backdrop click
 * @attr {boolean} modal - Use showModal() in toggle() (default: true)
 *
 * @method show() - Open non-modal
 * @method showModal() - Open modal with backdrop
 * @method close() - Close dialog
 * @method toggle() - Toggle based on `modal` attr
 *
 * @csspart dialog - Native `<dialog>` element
 * @csspart header - Header bar
 * @csspart main - Content area
 * @csspart footer - Footer container
 * 
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ WAI-ARIA Dialog (Modal) Pattern}
 */
export class Dialog extends CustomElement {
    static sheet = sheet;

    @query({
        selector: "dialog",
        load(this: Dialog, element: HTMLDialogElement) {
            element.setAttribute("aria-modal", String(this.ismodal));
        }
    }) private dialogElement!: HTMLDialogElement;
    @property({ rerender: true }) header?: string;
    @property({
        type: Boolean,
        after(this: Dialog) {
            if (this.open) 
            {
                // safaribug but first element of this dialog should get focus 
                let firstfocus = this.root.querySelector<HTMLElement>(FOCUSABLE);
                if (!firstfocus)
                {
                    firstfocus = this.querySelector<HTMLElement>(FOCUSABLE);
                }

                if (firstfocus) requestAnimationFrame(() => requestAnimationFrame(() => firstfocus.focus()));
            }

            if (this._internalopen) 
            {
                this._internalopen = false;
                return;
            }
            if (this.dialogElement) this.dialogElement.open = this.open;
        }
    }) open: boolean = false;
    @property({ type: Boolean, attribute: "close-outside-click" }) protected closeoutsideclick = false;
    @property({
        attribute: "modal",
        type: Boolean,
        after(this: Dialog) {
            if (!this.dialogElement) return;
            this.dialogElement.setAttribute("aria-modal", String(this.ismodal));
        }
    }) protected ismodal = true;

    private refs: Element[] = [];
    private _internalopen = false;
    private hasslotheader = false;
    private hasslotfooter = false;

    connectedCallback(): void {
        super.connectedCallback();

        const root = this.getRootNode();
        this.refs = [];
        if (!(root instanceof ShadowRoot || root instanceof Document)) return;

        root
            .querySelectorAll(`[commandfor="${this.id}"]`)
            .forEach(elm => {
                elm.addEventListener("click", this.handleCommandRefClick);
                if (!elm.hasAttribute("tabindex")) elm.setAttribute("tabindex", "0"); // safari bug 
                this.refs.push(elm);
            });

        root
            .querySelectorAll(`[popovertarget="${this.id}"]`)
            .forEach(elm => {
                elm.addEventListener("click", this.handlePopoverRefClick);
                this.refs.push(elm);
            });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.refs.forEach(elm => {
            elm.removeEventListener("click", this.handleCommandRefClick);
            elm.removeEventListener("click", this.handlePopoverRefClick);
        });
    }

    public show() {
        this._internalopen = true;
        this.open = true;
        this.dialogElement.show();
        this.ismodal = false;
    }
    public showModal() {
        this._internalopen = true;
        this.open = true;
        this.dialogElement.showModal();
        this.ismodal = true;
    }

    /**
     * @warning
     * this is not tested yet and might throw.
     */
    public showPopover() {
        this._internalopen = true;
        this.open = true;
        this.dialogElement.showPopover();
    }
    public close() {
        this._internalopen = true;
        this.open = false;
        this.dialogElement.close();
    }
    public toggle() {
        this.open ? this.close() : (this.ismodal ? this.showModal() : this.show());
    }

    @bind
    protected handleCommandRefClick(e: Event) {
        const { currentTarget } = e;
        if (!(currentTarget instanceof HTMLElement)) return;

        const command = currentTarget.getAttribute("command");
        if (command === "show-modal")
        {
            this.showModal();
        }
        else if (command === "show")
        {
            this.show();
        }
        else if (command === "toggle")
        {
            this.toggle();
        }
        else if (command === "close")
        {
            this.close();
        }
    }
    @bind
    protected handlePopoverRefClick() {
        this.showPopover();
    }
    @bind
    protected handleheaderslot(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        if (e.currentTarget.assignedNodes().length > 0) 
        {
            this.hasslotheader = true;
        }

        this.requestUpdate();
    }
    @bind
    protected handlefooterslot(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        if (e.currentTarget.assignedNodes().length > 0) 
        {
            this.hasslotfooter = true;
        }

        this.requestUpdate();
    }
    @bind
    protected handledialogclick(e: MouseEvent) {
        if (!this.closeoutsideclick) return;
        if (!this.open) return;

        const rect = this.dialogElement.getBoundingClientRect();

        const isInDialog =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;

        if (!isInDialog)
        {
            this.close();
        }
    }
    @bind
    protected handledialogclose() {
        this._internalopen = true;
        this.open = false;
    }

    render() {
        return html`
            <dialog 
                id="dialog" 
                part="dialog"
                @click="${this.handledialogclick}"
                @close="${this.handledialogclose}"
            >
                <header part="header">
                    <div>
                        <slot @slotchange="${this.handleheaderslot}" name="header"></slot>
                        ${!this.hasslotheader && this.header && html`<h1>${this.header}</h1>`}
                    </div>
                    <span>
                        <button aria-label="close" autofocus commandfor="dialog" command="close">
                            <pap-icon name="close"></pap-icon>
                        </button>
                    </span>
                </header>
                <main part="main">
                    <slot></slot>
                </main>
                <footer style="${!this.hasslotfooter && "padding:0 !important;"}" part="footer">
                    <slot @slotchange="${this.handlefooterslot}" name="footer"></slot>
                </footer>
            </dialog>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-dialog": Dialog;
    }
}