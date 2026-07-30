// import statements 
// system 
import { bind, CustomElement, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };

// foundations
import "@papit/group";

/**
 * Root accordion container. Manages open state across child headers
 * using a shared context value (array of open header ids).
 *
 * Implements the WAI-ARIA Accordion Pattern:
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/accordion/}
 *
 * @element pap-accordion
 *
 * @slot - One or more `pap-accordion-header` / `pap-accordion-panel` pairs,
 *         optionally wrapped in `div[role="region"]` elements.
 *
 * @attr {"single"|"multiple"} mode
 *   Controls how many panels may be open simultaneously.
 *   In `"single"` mode (default), opening one panel closes all others.
 *
 * @example Single panel
 * ```html
 * <pap-accordion>
 *   <pap-accordion-header>Billing</pap-accordion-header>
 *   <pap-accordion-panel>Your billing info here.</pap-accordion-panel>
 * </pap-accordion>
 * ```
 *
 * @example Multiple panels with region wrappers
 * ```html
 * <pap-accordion mode="multiple">
 *   <div role="region">
 *     <pap-accordion-header>Section 1</pap-accordion-header>
 *     <pap-accordion-panel>Content 1</pap-accordion-panel>
 *   </div>
 *   <div role="region">
 *     <pap-accordion-header>Section 2</pap-accordion-header>
 *     <pap-accordion-panel>Content 2</pap-accordion-panel>
 *   </div>
 * </pap-accordion>
 * ```
 */
export class Accordion extends CustomElement {
    static sheet = sheet;

    @property({
        context: true,
        type: Array,
        attribute: false,

        set(this: Accordion, value: string[]) {
            if (this.mode === "single") return [value.pop()].filter(Boolean);
            return value.filter(Boolean);
        }

    }) value: string[] = [];

    @property mode: "single" | "multiple" = "single";

    render() {
        return html`
            <pap-group aria-orientation="vertical" role="none">
                <slot></slot>
            </pap-group>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-accordion": Accordion;
    }
}