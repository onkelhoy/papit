// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// local 
import { FOCUSABLE } from "types";

/**
 * A structural, non-visual component that manages keyboard navigation
 * within a set of child elements using roving tabindex.
 *
 * @element pap-group
 *
 * @slot - Child elements to navigate between
 *
 * @attr {boolean} loop - Whether navigation wraps around at the ends (default: true)
 * @attr {"horizontal"|"vertical"} aria-orientation - Controls which arrow keys navigate (default: horizontal)
 * @attr {boolean} up - Enable ArrowUp navigation
 * @attr {boolean} down - Enable ArrowDown navigation
 * @attr {boolean} left - Enable ArrowLeft navigation
 * @attr {boolean} right - Enable ArrowRight navigation
 * @attr {boolean} home - Enable Home key navigation
 * @attr {boolean} end - Enable End key navigation
 *
 * @example
 * ```html
 * <pap-group>
 *   <pap-button>Bold</pap-button>
 *   <pap-button>Italic</pap-button>
 *   <pap-button>Underline</pap-button>
 * </pap-group>
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ WCAG Toolbar Pattern}
 */

export class Group extends CustomElement {

    @property({
        attribute: "aria-orientation",
        after(this: Group, value, old, initial) {
            if (initial) return;  // ← uncomment this
            this.up = this.orientation === "vertical";
            this.down = this.orientation === "vertical";
            this.left = this.orientation === "horizontal";
            this.right = this.orientation === "horizontal";
        }
    }) orientation: "horizontal" | "vertical" = "horizontal";

    @property({ type: Boolean }) loop = true;
    @property({ type: Boolean }) home = true;
    @property({ type: Boolean }) end = true;

    @property({ type: Boolean }) up = false;
    @property({ type: Boolean }) down = false;
    @property({ type: Boolean }) left = false;
    @property({ type: Boolean }) right = false;

    private elements: HTMLElement[] = [];
    private active = 0;

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "toolbar");
        this.addEventListener("focus", this.handlefocus);
        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("focusout", this.handlefocusout);

        if (!this.hasAttribute("up")) this.up = this.orientation === "vertical";
        if (!this.hasAttribute("down")) this.down = this.orientation === "vertical";
        if (!this.hasAttribute("left")) this.left = this.orientation === "horizontal";
        if (!this.hasAttribute("right")) this.right = this.orientation === "horizontal";
    }

    private handlekeydown = (e: KeyboardEvent) => {
        let handled = false;
        if (/ArrowUp/i.test(e.key) && this.up)
        {
            handled = true;
            this.prev();
        }
        if (/ArrowLeft/i.test(e.key) && this.left)
        {
            handled = true;
            this.prev();
        }
        if (/ArrowDown/i.test(e.key) && this.down)
        {
            handled = true;
            this.next();
        }
        if (/ArrowRight/i.test(e.key) && this.right)
        {
            handled = true;
            this.next();
        }
        if (/Home/i.test(e.key) && this.home)
        {
            handled = true;
            this.first();
        }
        if (/End/i.test(e.key) && this.end)
        {
            handled = true;
            this.last();
        }

        if (handled)
        {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    private handlefocus = () => {
        this.tabIndex = -1;
        this.deligateFocus(this.active);
    }
    private handlefocusout = (e: FocusEvent) => {
        if (this.contains(e.relatedTarget as Node)) return;
        this.tabIndex = 0;
    }
    private handleslotchange = (e: Event) => {
        if (!(e.target instanceof HTMLSlotElement)) return;

        const assigned = e.target.assignedElements({ flatten: true });
        this.elements = assigned.flatMap(el => {
            if (!(el instanceof HTMLElement)) return [];
            // if the element itself is focusable, use it
            if (el.matches(FOCUSABLE) || el.tabIndex >= 0) return [el];
            // otherwise look inside it
            return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        });
        this.tabIndex = 0;

        this.elements.forEach(el => {
            if (el.matches(FOCUSABLE) || el.tabIndex >= 0)
            {
                el.tabIndex = -1
                el.setAttribute("data-focusable", "");
            }
        });
    }
    private isElementFocusable(element: HTMLElement) {
        if (element.hasAttribute("disabled")) return false;
        if (!element.matches(FOCUSABLE)) return false;
        if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;

        return true;
    }
    private deligateFocus(to: number) {
        this.active = to;
        const target = this.elements.at(this.active);
        if (target) target.focus();
    }
    private nextUntil(index: number) {
        if (this.isElementFocusable(this.elements[index])) return index;
        let start = index;
        let current = index + 1;
        // one full loop 
        while (current != start)
        {
            if (current > this.elements.length - 1)
            {
                if (!this.loop) return false;
                current = 0;
            }

            if (this.isElementFocusable(this.elements[current])) return current;
            current++;
        }

        return false;
    }
    private prevUntil(index: number) {
        if (this.isElementFocusable(this.elements[index])) return index;
        let start = index;
        let current = index - 1;
        // one full loop 
        while (current != start)
        {
            if (current < 0)
            {
                if (!this.loop) return false;
                current = this.elements.length - 1;
            }

            if (this.isElementFocusable(this.elements[current])) return current;
            current--;
        }

        return false;
    }

    first() {
        const index = this.nextUntil(0);
        if (index === false) throw new Error("all elements are disabled");
        this.deligateFocus(index);
    }
    last() {
        const index = this.prevUntil(this.elements.length - 1);
        if (index === false) throw new Error("all elements are disabled");
        this.deligateFocus(index);
    }
    prev() {
        let value = this.active - 1;
        if (value < 0)
        {
            if (!this.loop) return;
            value = this.elements.length - 1;
        }
        const index = this.prevUntil(value);
        if (index === false) throw new Error("all elements are disabled");
        this.deligateFocus(index);
    }
    next() {
        let value = this.active + 1;
        if (value > this.elements.length - 1)
        {
            if (!this.loop) return;
            value = 0;
        }
        const index = this.nextUntil(value);
        if (index === false) throw new Error("all elements are disabled");
        this.deligateFocus(index);
    }

    render() {
        return html`
            <slot @slotchange="${this.handleslotchange}"></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-group": Group;
    }
}