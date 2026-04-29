// import statements 
// system 
import { bind, CustomElement, html, property, query } from "@papit/web-component";

// foundations 
import "@papit/icon";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * A wrapper around the native `<dialog>` element that adds slot-based composition,
 * a built-in close button, optional backdrop-click dismissal, and imperative API methods.
 * Supports the WAI-ARIA Dialog (Modal) pattern.
 *
 * @element pap-dialog
 *
 * @slot - Default slot — the main body content of the dialog
 * @slot header - Optional header content; overrides the `header` attribute when provided
 * @slot footer - Optional footer content; hidden (zero padding) when empty
 *
 * @attr {string}  header              - Text rendered as an `<h1>` inside the header area.
 *                                       Ignored when the `header` slot is filled.
 * @attr {boolean} open                - Reflects the open state of the underlying `<dialog>`.
 *                                       Set programmatically or via the public methods.
 * @attr {boolean} close-outside-click - When present, clicking the backdrop closes the dialog.
 *
 * @csspart dialog - The native `<dialog>` element
 * @csspart header - The `<header>` bar containing the title area and close button
 * @csspart main   - The `<main>` scrollable content area
 * @csspart footer - The `<footer>` slot container
 *
 * @method show()        - Opens the dialog as a non-modal (maps to `HTMLDialogElement.show()`)
 * @method showModal()   - Opens the dialog as a modal with backdrop (maps to `HTMLDialogElement.showModal()`)
 * @method showPopover() - (NOT TESTED) Opens the dialog via the Popover API (maps to `HTMLDialogElement.showPopover()`)
 * @method close()       - Closes the dialog (maps to `HTMLDialogElement.close()`)
 *
 * @example Basic modal dialog triggered by a button
 * ```html
 * <button commandfor="my-dialog" command="show-modal">Open</button>
 *
 * <pap-dialog id="my-dialog" header="Confirm action">
 *   <p>Are you sure you want to continue?</p>
 *   <div slot="footer">
 *     <button commandfor="my-dialog" command="close">Cancel</button>
 *     <button>Confirm</button>
 *   </div>
 * </pap-dialog>
 * ```
 *
 * @example Non-modal dialog opened imperatively
 * ```html
 * <pap-dialog id="info-dialog" header="Info">
 *   <p>This is a non-modal dialog.</p>
 * </pap-dialog>
 *
 * <script type="module">
 *   document.querySelector('#info-dialog').show();
 * </script>
 * ```
 *
 * @example Dismiss on backdrop click
 * ```html
 * <pap-dialog header="Click outside to close" close-outside-click>
 *   <p>Dialog content</p>
 * </pap-dialog>
 * ```
 *
 * @example Custom header via slot
 * ```html
 * <pap-dialog>
 *   <div slot="header">
 *     <pap-icon name="warning"></pap-icon>
 *     <strong>Warning</strong>
 *   </div>
 *   <p>Something went wrong.</p>
 * </pap-dialog>
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ WAI-ARIA Dialog (Modal) Pattern}
 */

export class Dialog extends CustomElement {
    static sheet = sheet;

    @query({
        selector: "dialog",
        load(this: Dialog, element: HTMLDialogElement) {
            element.addEventListener("click", this.handledialogclick);
            element.addEventListener("close", this.handlativedialogclose);
        }
    }) private dialogElement!: HTMLDialogElement;
    @property({
        rerender: true,
        aria: ""
    }) header?: string;
    @property({
        type: Boolean,
        after(this: Dialog) {
            if (this._internalopen) 
            {
                this._internalopen = false;
                return;
            }
            if (this.dialogElement) this.dialogElement.open = this.open;
        }
    }) open: boolean = false;
    @property({ type: Boolean, attribute: "close-outside-click" }) closeoutsideclick = false;

    private refs: Element[] = [];
    private _internalopen = false;
    private hasslotheader = false;
    private hasslotfooter = false;

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "dialog");

        const root = this.getRootNode();
        this.refs = [];
        if (!(root instanceof ShadowRoot || root instanceof Document)) return;

        root
            .querySelectorAll(`[commandfor="${this.id}"]`)
            .forEach(elm => {
                elm.addEventListener("click", this.handleCommandRefClick);
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
    }
    public showModal() {
        this._internalopen = true;
        this.open = true;
        this.dialogElement.showModal();
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

    @bind
    private handleCommandRefClick(e: Event) {
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
        else if (command === "close")
        {
            this.close();
        }
    }
    @bind
    private handlePopoverRefClick() {
        this.showPopover();
    }
    @bind
    private handleheaderslot(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        if (e.currentTarget.assignedNodes().length > 0) 
        {
            this.hasslotheader = true;
        }

        this.requestUpdate();
    }
    @bind
    private handlefooterslot(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        if (e.currentTarget.assignedNodes().length > 0) 
        {
            this.hasslotfooter = true;
        }

        this.requestUpdate();
    }
    @bind
    private handledialogclick(e: MouseEvent) {
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
    private handlativedialogclose() {
        this._internalopen = true;
        this.open = false;
    }

    render() {
        return html`
            <dialog id="dialog" part="dialog">
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