// import statements 
// system 
import { bind, CustomElement, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };
import type { JoystickMode, Layout } from "./types";

/**
 * `<pap-joystick>` — a touch joystick for browser games. The host is the touch area; read
 * `x`, `y` and `strength` once per frame, no per-frame events are fired.
 *
 * @element pap-joystick
 * @slot - `pap-joystick-button` elements, each placed with `--x` / `--y`.
 * @csspart base - The stick's base ring.
 * @csspart stick - The moving thumb.
 * @fires layout-change - After a control is dragged in `editable` mode; `detail` is the `Layout`.
 */
export class Joystick extends CustomElement {
    static sheet = sheet;

    // properties 
    /** `follow` jumps under the thumb and is dragged along past the edge, `floating` only jumps, `fixed` stays where placed. */
    @property({ type: String }) mode: JoystickMode = "follow";
    /** Lets the player drag the stick and buttons to new spots; input is off while editing. */
    @property({ type: Boolean, after(this: Joystick) { this.reset(); } }) editable = false;

    /** Horizontal axis, -1 (left) to 1 (right). */
    public x = 0;
    /** Vertical axis, -1 (up) to 1 (down), same direction as the screen. */
    public y = 0;
    /** Distance from the centre, 0 to 1. */
    public strength = 0;

    @query("#base") private base!: HTMLElement;

    private pointer: number | null = null;
    private centerx = 0;
    private centery = 0;
    private radius = 1;
    private dragging: HTMLElement | null = null;

    /** Positions of the stick (`stick`) and buttons (their `name`, or index), in percent. */
    get layout(): Layout {
        const layout: Layout = {};
        this.controls().forEach(([key, element]) => {
            const style = getComputedStyle(element);
            layout[key] = { x: parseFloat(style.getPropertyValue("--x")), y: parseFloat(style.getPropertyValue("--y")) };
        });
        return layout;
    }
    set layout(layout: Layout) {
        this.controls().forEach(([key, element]) => {
            const position = layout[key];
            if (!position) return;
            element.style.setProperty("--x", `${position.x}%`);
            element.style.setProperty("--y", `${position.y}%`);
        });
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("pointerdown", this.handlepointerdown);
        this.addEventListener("pointermove", this.handlepointermove);
        this.addEventListener("pointerup", this.handlepointerup);
        this.addEventListener("pointercancel", this.handlepointerup);
        this.addEventListener("lostpointercapture", this.handlepointerup);
        this.addEventListener("contextmenu", this.handlecontextmenu);
        window.addEventListener("blur", this.handlepointerup);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("pointerdown", this.handlepointerdown);
        this.removeEventListener("pointermove", this.handlepointermove);
        this.removeEventListener("pointerup", this.handlepointerup);
        this.removeEventListener("pointercancel", this.handlepointerup);
        this.removeEventListener("lostpointercapture", this.handlepointerup);
        this.removeEventListener("contextmenu", this.handlecontextmenu);
        window.removeEventListener("blur", this.handlepointerup);
        this.reset();
    }

    // event handlers
    @bind
    private handlepointerdown(event: PointerEvent) {
        if (this.pointer !== null || !this.base) return;
        const button = (event.target as Element).closest?.("pap-joystick-button") as HTMLElement | null;

        if (this.editable)
        {
            const target = button ?? (event.composedPath().includes(this.base) ? this.base : null);
            if (!target) return;
            this.dragging = target;
            this.pointer = event.pointerId;
            this.setPointerCapture?.(event.pointerId);
            return;
        }

        // buttons handle their own pointers
        if (button) return;

        if (this.mode !== "fixed")
        {
            const area = this.getBoundingClientRect();
            this.base.style.setProperty("--x", `${(event.clientX - area.left) / area.width * 100}%`);
            this.base.style.setProperty("--y", `${(event.clientY - area.top) / area.height * 100}%`);
        }
        else if (!event.composedPath().includes(this.base)) return;

        const rect = this.base.getBoundingClientRect();
        this.centerx = rect.left + rect.width / 2;
        this.centery = rect.top + rect.height / 2;
        this.radius = rect.width / 2 || 1;
        this.pointer = event.pointerId;
        this.setPointerCapture?.(event.pointerId);
        this.base.toggleAttribute("active", true);
        this.move(event);
    }

    @bind
    private handlepointermove(event: PointerEvent) {
        if (event.pointerId !== this.pointer) return;
        if (this.dragging)
        {
            const area = this.getBoundingClientRect();
            const x = Math.min(Math.max((event.clientX - area.left) / area.width * 100, 0), 100);
            const y = Math.min(Math.max((event.clientY - area.top) / area.height * 100, 0), 100);
            this.dragging.style.setProperty("--x", `${x}%`);
            this.dragging.style.setProperty("--y", `${y}%`);
            return;
        }
        this.move(event);
    }

    @bind
    private handlepointerup(event: Event) {
        if (event instanceof PointerEvent && event.pointerId !== this.pointer) return;
        if (this.dragging)
        {
            this.dragging = null;
            this.pointer = null;
            this.dispatchEvent(new CustomEvent<Layout>("layout-change", { detail: this.layout }));
            return;
        }
        this.reset();
    }

    // long-press on touch would open the context menu
    @bind
    private handlecontextmenu(event: Event) {
        event.preventDefault();
    }

    // helpers
    private move(event: PointerEvent) {
        let dx = (event.clientX - this.centerx) / this.radius;
        let dy = (event.clientY - this.centery) / this.radius;
        const length = Math.hypot(dx, dy);
        if (length > 1 && this.mode === "follow")
        {
            // drag the base along so the thumb stays on the edge
            const excess = (length - 1) / length;
            this.centerx += (event.clientX - this.centerx) * excess;
            this.centery += (event.clientY - this.centery) * excess;
            const area = this.getBoundingClientRect();
            this.base.style.setProperty("--x", `${(this.centerx - area.left) / area.width * 100}%`);
            this.base.style.setProperty("--y", `${(this.centery - area.top) / area.height * 100}%`);
        }
        if (length > 1)
        {
            dx /= length;
            dy /= length;
        }
        this.x = dx;
        this.y = dy;
        this.strength = Math.min(length, 1);
        this.base.style.setProperty("--stick-x", String(dx));
        this.base.style.setProperty("--stick-y", String(dy));
    }

    private controls(): [string, HTMLElement][] {
        const buttons = [...this.querySelectorAll<HTMLElement>(":scope > pap-joystick-button")];
        const controls: [string, HTMLElement][] = buttons.map((button, index) => [button.getAttribute("name") ?? String(index), button]);
        if (this.base) controls.unshift(["stick", this.base]);
        return controls;
    }

    private reset() {
        this.pointer = null;
        this.dragging = null;
        this.x = 0;
        this.y = 0;
        this.strength = 0;
        if (!this.base) return;
        this.base.removeAttribute("active");
        this.base.style.setProperty("--stick-x", "0");
        this.base.style.setProperty("--stick-y", "0");
    }

    render() {
        return html`
            <div id="base" part="base">
                <div id="stick" part="stick"></div>
            </div>
            <slot></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-joystick": Joystick;
    }
}
