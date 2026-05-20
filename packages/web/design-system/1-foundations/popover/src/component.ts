// import statements 
// system 
import { bind, CustomElement, debounce, generateUUID, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * `Popover` is a positioned overlay component built on the native Popover API
 * and CSS Anchor Positioning. Connect it to any trigger element using the
 * standard `popovertarget` attribute — no JavaScript required for basic usage.
 *
 * @example
 * <!-- click to toggle -->
 * <button popovertarget="my-pop">Open</button>
 * <pap-popover id="my-pop" placement="bottom">Hello!</pap-popover>
 *
 * @example
 * <!-- hover to show -->
 * <button popovertarget="my-pop" popovertargetaction="hover">Hover me</button>
 * <pap-popover id="my-pop" placement="top">Tooltip content</pap-popover>
 *
 * @element pap-popover
 *
 * @prop {boolean} open - Whether the popover is visible.
 * @prop {string} placement - Preferred placement relative to the trigger anchor.
 *   Single-axis values (`"top"`, `"bottom"`, `"left"`, `"right"`) resolve to
 *   their centered variant. Full list: `top`, `top-left`, `top-right`,
 *   `top-center`, `bottom`, `bottom-left`, `bottom-right`, `bottom-center`,
 *   `left`, `left-top`, `left-bottom`, `left-center`, `right`, `right-top`,
 *   `right-bottom`, `right-center`. Defaults to `"bottom"`.
 *
 * @fires {Event} toggle - Fired by the native Popover API when visibility changes.
 *
 * @method show(element?) - Show the popover, optionally anchored to a specific element.
 * @method hide() - Hide the popover.
 * @method toggle(element?) - Toggle the popover, optionally anchored to a specific element.
 */
export class Popover extends CustomElement {
    static sheet = sheet;

    @property({
        type: Boolean,
        after(this: Popover) {
            if (!this.hasAttribute("popover")) return;

            if (this.open) this.showPopover();
            else this.hidePopover();
        }
    }) open = false;

    private hovermode = false;
    private hover = false;
    private refhover: string | null = null;
    protected refs: HTMLElement[] = [];

    /**
     * Controls the preferred placement of the element relative to its anchor.
     *
     * - Single-axis values (`"top"`, `"bottom"`, `"left"`, `"right"`) resolve
     *   to their centered variant — e.g. `"bottom"` behaves as `"bottom-center"`.
     * - The component will automatically fall back to other placements if the
     *   preferred one does not fit the viewport.
     *
     * @default "bottom"
     */
    @property placement:
        | "top" | "bottom" | "left" | "right"
        | "top-left" | "top-right" | "top-center"
        | "bottom-left" | "bottom-right" | "bottom-center"
        | "left-top" | "left-bottom" | "left-center"
        | "right-top" | "right-bottom" | "right-center" = "bottom";

    connectedCallback(): void {
        super.connectedCallback();

        const root = this.getRootNode();
        this.refs = [];
        if (!(root instanceof ShadowRoot || root instanceof Document)) return;

        // lets first check any refs bounded wihtin (slot)
        this.populaterefs(this);
        this.populaterefs(root);

        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("mouseover", this.handlemouseover);
        this.addEventListener("mouseleave", this.handlemouseleave);

        this.setAttribute("popover", "manual");
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.refs.forEach(ref => {
            ref.removeEventListener("click", this.handlerefclick);
            ref.removeEventListener("mouseover", this.handlerefmouseover);
            ref.removeEventListener("mouseleave", this.handlerefmouseover);
        });

        this.removeEventListener("keydown", this.handlekeydown);
        this.removeEventListener("mouseover", this.handlemouseover);
    }

    private populaterefs(root: HTMLElement | ShadowRoot | Document) {
        root
            .querySelectorAll(`[popovertarget="${this.id}"]`)
            .forEach(elm => {
                if (!(elm instanceof HTMLElement)) return;

                elm.addEventListener("click", this.handlerefclick);
                elm.addEventListener("mouseover", this.handlerefmouseover);
                elm.addEventListener("mouseleave", this.handlerefmouseleave);
                elm.style.setProperty("anchor-name", "--" + generateUUID());
                this.refs.push(elm);
            });
    }

    private setupanchor(ref: HTMLElement) {
        const anchor = ref.style.getPropertyValue("anchor-name");
        if (!anchor) return;

        this.style.setProperty("position-anchor", anchor);
    }

    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (e.key === "esc") 
        {
            e.preventDefault();
            this.hide();
        }
    }

    @bind
    private handlemouseover(e: MouseEvent) {
        if (!this.hovermode) return;
        this.hover = true;
    }

    @bind
    private handlemouseleave(e: MouseEvent) {
        if (!this.hovermode) return;
        this.hover = false;
        this.hoverhide();
    }

    @bind
    protected handlerefclick(e: Event) {
        const { currentTarget } = e;
        if (!(currentTarget instanceof HTMLElement)) return;
        e.preventDefault();
        const popovertargetaction = currentTarget.getAttribute("popovertargetaction");

        switch (popovertargetaction) 
        {
            case "hover":
                e.preventDefault();
                break;
            case "show":
                this.show(currentTarget);
                break;
            case "hide":
                this.hide();
                break;
            default:
                this.toggle(currentTarget);
                break;
        }
    }

    @bind
    private handlerefmouseover(e: Event) {
        const { currentTarget } = e;
        if (!(currentTarget instanceof HTMLElement)) return;
        const popovertargetaction = currentTarget.getAttribute("popovertargetaction");
        if (popovertargetaction !== "hover") return;
        const anchor = currentTarget.style.getPropertyValue("anchor-name");
        if (!anchor) return;

        this.refhover = anchor;
        this.hovermode = true;
        this.onRefMouseOver(currentTarget);
    }
    @bind
    private handlerefmouseleave(e: Event) {
        const { currentTarget } = e;
        if (!(currentTarget instanceof HTMLElement)) return;
        const popovertargetaction = currentTarget.getAttribute("popovertargetaction");
        if (popovertargetaction !== "hover") return;
        const anchor = currentTarget.style.getPropertyValue("anchor-name");
        if (anchor !== this.refhover) return;

        this.refhover = null; // only if this ref was the one who has the current hover 
        this.onRefMouseLeave(currentTarget);
    }

    @debounce(1)
    protected hoverhide() {
        if (this.hover) return;
        if (this.refhover) return;

        this.hide();
        this.hovermode = false;
    }

    public show(element?: HTMLElement) {
        this.open = true;
        if (element) this.setupanchor(element);
    }

    public hide() {
        this.open = false;
    }

    public toggle(element?: HTMLElement) {
        if (this.open) this.hide();
        else this.show(element);
    }

    protected onRefMouseOver(element: HTMLElement) {
        this.show(element);
    }

    protected onRefMouseLeave(element: HTMLElement) {
        this.hoverhide();
    }

    render() {
        return html`
            <slot></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-popover": Popover;
    }
}