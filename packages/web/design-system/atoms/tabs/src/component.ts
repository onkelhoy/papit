// import statements 
// system 
import { bind, CustomElement, html, property } from "@papit/web-component";

// foundations 
import { Group } from "@papit/group";
import "@papit/group";

// local 
import { Tab } from "components/tab/component";
import sheet from "./style.css" assert { type: "css" };

/**
 * # Tabs
 *
 * Container component that manages a tabbed interface consisting of `pap-tab` and
 * `pap-tabpanel` elements. Implements the
 * @see [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
 *
 * ## ARIA roles
 * - Renders a `<pap-group role="tablist">` that wraps all assigned tab elements.
 * - Delegates `aria-orientation` to the internal tablist element.
 *
 * ## Slot behaviour
 * Un-named slot children are inspected on `slotchange`. Any element with
 * `role="tab"` or that is a `Tab` instance is moved to the `tab` named slot
 * (inside the tablist) and assigned a sequential `key` attribute. The first
 * discovered tab value is used as the initial `value` selection.
 *
 * ## Context
 * Provides `value` and `mode` as context properties consumed by child `Tab`
 * and `TabPanel` elements.
 *
 * @element pap-tabs
 *
 * @slot - Default slot. Accepts `pap-tab` and `pap-tabpanel` elements.
 *         Tabs are automatically re-slotted into the internal tablist.
 * @slot tab - Internal named slot rendered inside the `<pap-group role="tablist">`.
 *             Populated automatically — do not slot content here manually.
 *
 * @attr {"horizontal"|"vertical"} aria-orientation - Orientation of the tab list.
 *        Passed through to the inner `<pap-group>`. Defaults to `"horizontal"`.
 * @attr {string} value - Value of the currently active tab.
 *
 * @csspart tablist - The `<pap-group>` element wrapping the tab buttons.
 *
 * @example
 * ```html
 * <pap-tabs>
 *   <pap-tab value="first">First</pap-tab>
 *   <pap-tab value="second">Second</pap-tab>
 *   <pap-tabpanel value="first">Content A</pap-tabpanel>
 *   <pap-tabpanel value="second">Content B</pap-tabpanel>
 * </pap-tabs>
 * ```
 *
 * @example Vertical orientation
 * ```html
 * <pap-tabs aria-orientation="vertical">
 *   <pap-tab value="a">Alpha</pap-tab>
 *   <pap-tabpanel value="a">Alpha panel</pap-tabpanel>
 * </pap-tabs>
 * ```
 */
export class Tabs extends CustomElement {
    static sheet = sheet;

    @property({
        attribute: "aria-orientation",
        rerender: true,
    }) orientation: Group["orientation"] = "horizontal";

    @property({
        context: true,
        attribute: "value",
        after(this: Tabs) {
            this.dispatchEvent(new Event("change"));
        }
    }) value?: string;

    @property({ context: true }) mode: "scroll" | "default" = "default"; // TODO 
    @property({ attribute: "aria-label", rerender: true }) label?: string;

    @bind
    private handleslotchange(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        const elements = e.currentTarget.assignedElements();
        elements.forEach((elm, index) => {
            const role = elm.getAttribute("role");
            if (!(role === "tab" || elm instanceof Tab)) return;

            if (!this.value) 
            {
                this.value = elm.getAttribute("value") ?? undefined;
            }
            elm.setAttribute("slot", "tab");
        });
    }

    render() {
        return html`
            <pap-group 
                part="tablist" 
                role="tablist" 
                aria-orientation="${this.orientation}"
                ${this.label && `aria-label="${this.label}"`} 
            >
                <slot name="tab"></slot>
            </pap-group>

            <slot @slotchange="${this.handleslotchange}"></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-tabs": Tabs;
    }
}