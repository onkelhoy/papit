// import statements 
// system 
import { bind, CustomElement, html } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };

/**
 * `<pap-joystick-button>` — a touch button for browser games, usually slotted in `<pap-joystick>`.
 * Read `pressed` once per frame, or listen to `press` / `release`.
 *
 * @element pap-joystick-button
 * @slot - Label or icon.
 * @fires press - When a pointer goes down on the button.
 * @fires release - When that pointer is lifted or cancelled.
 */
export class JoystickButton extends CustomElement {
    static sheet = sheet;

    /** Whether the button is held down right now. */
    public pressed = false;

    private pointer: number | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("pointerdown", this.handlepointerdown);
        this.addEventListener("pointerup", this.handlepointerup);
        this.addEventListener("pointercancel", this.handlepointerup);
        this.addEventListener("lostpointercapture", this.handlepointerup);
        this.addEventListener("contextmenu", this.handlecontextmenu);
        window.addEventListener("blur", this.handlepointerup);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("pointerdown", this.handlepointerdown);
        this.removeEventListener("pointerup", this.handlepointerup);
        this.removeEventListener("pointercancel", this.handlepointerup);
        this.removeEventListener("lostpointercapture", this.handlepointerup);
        this.removeEventListener("contextmenu", this.handlecontextmenu);
        window.removeEventListener("blur", this.handlepointerup);
        this.release();
    }

    // event handlers
    @bind
    private handlepointerdown(event: PointerEvent) {
        if (this.pointer !== null || this.closest("pap-joystick[editable]")) return;
        this.pointer = event.pointerId;
        this.setPointerCapture?.(event.pointerId);
        this.pressed = true;
        this.toggleAttribute("pressed", true);
        this.dispatchEvent(new Event("press", { bubbles: true }));
    }

    @bind
    private handlepointerup(event: Event) {
        if (event instanceof PointerEvent && event.pointerId !== this.pointer) return;
        this.release();
    }

    @bind
    private handlecontextmenu(event: Event) {
        event.preventDefault();
    }

    // helpers
    private release() {
        this.pointer = null;
        if (!this.pressed) return;
        this.pressed = false;
        this.removeAttribute("pressed");
        this.dispatchEvent(new Event("release", { bubbles: true }));
    }

    render() {
        return html`<slot></slot>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-joystick-button": JoystickButton;
    }
}
