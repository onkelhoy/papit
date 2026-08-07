// import statements 
// system 
import { context, CustomElement, generateUUID, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };
import { Helper } from "components/helper";

/**
 * # TabPanel
 *
 * The content panel associated with a `pap-tab`. Implements the `tabpanel` role
 * as specified by the
 * @see [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
 *
 * ## ARIA roles & states
 * - Sets `role="tabpanel"` on itself at connect time.
 * - Sets `aria-labelledby` to the `id` of the matching `pap-tab`.
 * - Receives the `:state(selected)` CSS custom state when its `value` matches
 *   the active context value; use this state to show/hide the panel.
 *
 * ## Visibility
 * Show/hide is entirely CSS-driven. Target the custom state selector:
 * ```css
 * pap-tabpanel { display: none; }
 * pap-tabpanel:state(selected) { display: block; }
 * ```
 *
 * @element pap-tabpanel
 *
 * @slot - Panel content displayed when this panel is selected.
 *
 * @attr {string} value - Identifier that links this panel to its `pap-tab`.
 *
 * @example
 * ```html
 * <pap-tabpanel value="settings">
 *   <p>Settings content here.</p>
 * </pap-tabpanel>
 * ```
 */
export class TabPanel extends Helper {
    static sheet = sheet;

    @context({ attribute: "data-mode" }) mode: "scroll" | "default" = "default";

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "tabpanel");
    }

    protected override setOpposite(element: HTMLElement): void {
        element.id = element.id || generateUUID();
        this.setAttribute("aria-labelledby", element.id);
    }

    render() {
        return "<slot></slot>"
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-tabpanel": TabPanel;
    }
}

