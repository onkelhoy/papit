// import statements 
// system 
import { bind, context, CustomElement, generateUUID, html, property } from "@papit/web-component";

// atoms 
import "@papit/button";

// local 
import sheet from "./style.css" assert { type: "css" };
import { Helper } from "components/helper";

/**
 * # Tab
 *
 * An individual tab button rendered inside the tablist of a parent `pap-tabs`
 * component. Implements the `tab` role as specified by the
 * @see [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
 *
 * ## ARIA roles & states
 * - Sets `role="tab"` on itself at connect time.
 * - Sets `aria-selected="true"` when its `value` matches the active context
 *   value, `"false"` otherwise.
 * - Sets `aria-controls` to the `id` of the matching `pap-tabpanel`.
 * - Receives the `:state(selected)` CSS custom state.
 *
 * ## Activation
 * The tab activates (sets `tabs.value`) on both `click` and `focusin`, which
 * follows the *automatic activation* recommendation of the APG pattern — focus
 * alone is sufficient to switch the visible panel, provided panel content loads
 * without noticeable latency.
 *
 * ## Keyboard
 * Arrow-key navigation is delegated to the parent `<pap-group loop="false">`
 * tablist, which implements roving tabindex. `Tab` itself participates with an
 * initial `tabindex="0"`.
 *
 * @element pap-tab
 *
 * @slot - Label content for the tab button.
 *
 * @attr {string} value - Identifier that links this tab to its `pap-tabpanel`.
 *
 * @example
 * ```html
 * <pap-tab value="settings">Settings</pap-tab>
 * ```
 */
export class Tab extends Helper {
    static sheet = sheet;

    @context mode: "scroll" | "default" = "default";

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "tab");
        this.addEventListener("focusin", this.select);
        this.addEventListener("click", this.select);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this.removeEventListener("focusin", this.select);
        this.removeEventListener("click", this.select);
    }

    protected override setOpposite(element: HTMLElement): void {
        element.id = element.id || generateUUID();
        this.setAttribute("aria-controls", element.id);
    }

    @bind
    private select(e: Event) {
        if (e && e.target !== this) return;

        if (!this.tabs) return;
        if (this.tabs.value === this.value) return;

        this.tabs.value = this.value;
    }

    render() {
        return "<slot></slot>";
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-tab": Tab;
    }
}