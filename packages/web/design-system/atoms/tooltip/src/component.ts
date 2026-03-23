// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";
import "../../../1-foundations/placement/lib/bundle";
import { type Placement } from "../../../1-foundations/placement/lib/bundle";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * A tooltip component that displays contextual information when a target element
 * is hovered or focused.
 *
 * @element pap-tooltip
 *
 * @slot - Default slot for tooltip content (can be rich HTML)
 * @slot target - The element that triggers the tooltip on hover/focus
 *
 * @attr {string} placement - Placement of the tooltip relative to the target
 * @attr {number} delay - Delay in ms before showing the tooltip (default: 1000)
 *
 * @example
 * ```html
 * <pap-tooltip>
 *   <button slot="target">💾</button>
 *   Save the file
 * </pap-tooltip>
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ WCAG Tooltip Pattern}
 */
export class Tooltip extends CustomElement {
    static sheet = sheet;

    private static SUBSCRIBERS: Map<string, Function> = new Map();
    private static CURRENT: string | null = null; // used later to either do a delayed open or if already open then instant 
    private static changeCurrent(id: string) {
        this.CURRENT = id;
        this.SUBSCRIBERS.forEach((sub, key) => {
            if (key !== id) sub()
        });
    }

    private contentid: string;
    private elements: Element[] = [];
    private enterMode: "focus" | "mouse" | null = null;
    private timer: NodeJS.Timeout | null = null;

    constructor() {
        // super({ lightDOM: true });
        super();

        this.contentid = `content-${Tooltip.SUBSCRIBERS.size}`;
    }

    @property variant: "primary" | "secondary" = "primary";
    @property({ rerender: true, attribute: "placement" }) placement: Placement['placement'] = "top";
    @property({ type: Number, attribute: "delay" }) delay = 2000;
    @property({ reflect: false, rerender: true }) private state: "hidden" | "closing" | "open" = "hidden";
    @property({
        type: Boolean,
        after(this: Tooltip, value: boolean) {

            if (value) this.close();
        }
    }) disabled = false;

    connectedCallback(): void {
        super.connectedCallback();

        this.addEventListener("mouseleave", this.handlemouseleave);
        this.addEventListener("focusout", this.handlefocusout);

        Tooltip.SUBSCRIBERS.set(this.contentid, this.close);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.elements.forEach(element => {
            element.removeEventListener("mouseover", this.handleelementmouseover);
            element.removeEventListener("focus", this.handleelementfocus);
        });

        if (this.timer) clearTimeout(this.timer);
        Tooltip.SUBSCRIBERS.delete(this.contentid);
    }

    // events 
    private handleslot = (e: Event) => {
        if (!(e.target instanceof HTMLSlotElement)) return;

        if (e.target.name != "target") return;

        // cleanup old
        this.elements.forEach(element => {
            element.removeEventListener("mouseover", this.handleelementmouseover);
            element.removeEventListener("focus", this.handleelementfocus);
        });
        this.elements = [];

        // we have to assume multiple - but it really should be one 
        e.target.assignedElements().forEach(element => {
            this.elements.push(element);
            element.setAttribute("aria-describedby", this.contentid);

            element.addEventListener("mouseover", this.handleelementmouseover);
            element.addEventListener("focus", this.handleelementfocus);
        });
    }

    private handleelementmouseover = () => {
        if (this.disabled) return;
        if (this.enterMode != null) return; // focus has priority
        this.enterMode = "mouse";
        this.open();
    }
    private handleelementfocus = () => {
        if (this.disabled) return;
        this.enterMode = "focus";
        this.open();
    }
    private handlemouseleave = () => {
        if (this.enterMode != "mouse") return;
        this.close();
    }
    private handlefocusout = () => {
        if (this.enterMode != "focus") return;
        this.close();
    }
    private handleanimationend = (e: AnimationEvent) => {
        if (e.animationName != "tooltip-out") return;
        if (this.state != "closing") return;

        this.state = "hidden";
        if (Tooltip.CURRENT === this.contentid)
        {
            Tooltip.CURRENT = null;
        }
    }

    // private functions 
    private open() {
        if (this.timer) clearTimeout(this.timer);
        if (this.disabled) return void this.close();

        if (Tooltip.CURRENT) 
        {
            // show instantly 
            this.state = "open";
        }
        else 
        {
            // show after delay 
            this.timer = setTimeout(() => {
                this.state = "open";
            }, this.delay);
        }

        Tooltip.changeCurrent(this.contentid);
    }
    private close = () => {
        if (this.timer) clearTimeout(this.timer);
        if (this.state === "hidden") return;
        this.enterMode = null;
        this.state = "closing";
    }

    render() {
        return html`
            <slot @slotchange="${this.handleslot}" name="target"></slot>
            <pap-placement 
                @animationend="${this.handleanimationend}"
                part="placement"
                role="tooltip" 
                placement="${this.placement}" 
                id="${this.contentid}"
                ${this.state == "open" && "data-open"}
                ${this.state == "closing" && "data-closing"}
            >
                <slot></slot>
            </pap-placement>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-tooltip": Tooltip;
    }
}