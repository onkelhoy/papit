// import statements 
// system 
import { bind, CustomElementInternals, html, property, query } from "@papit/web-component";

// foundations 
import "@papit/icon";
import "@papit/button";
import "@papit/treeview";

// atoms 
import "@papit/tooltip";

// tools 
import { translate, useTranslator } from "@papit/translator";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * Collapsible sidebar navigation panel. Expands on hamburger click or by clicking/hovering
 * the empty nav area when collapsed; collapses on hamburger click or `Escape`.
 *
 * @example
 * ```html
 * <pap-sidebar>
 *   <div slot="header">Logo</div>
 *   <ul>
 *     <li>Dashboard</li>
 *     <li>Settings</li>
 *   </ul>
 *   <div slot="footer">v1.0.0</div>
 * </pap-sidebar>
 * ```
 *
 * @slot - Main navigation content (e.g. a list of links)
 * @slot header - Content shown above the nav, next to the hamburger button
 * @slot footer - Content pinned to the bottom of the panel
 *
 * @attr {boolean} open - Whether the sidebar is expanded (default: false)
 *
 * @csspart panel - Sticky outer wrapper; owns the width transition
 * @csspart container - Fixed inner panel holding header/nav/footer
 * @csspart header - Header region with the header slot and hamburger button
 * @csspart hamburger - The toggle button (`pap-button`)
 * @csspart nav - Navigation region wrapping the default slot
 * @csspart footer - Footer region containing the footer slot
 *
 * @remarks
 * Exposes a `hover` custom state (`:state(hover)`) while collapsed and the pointer is over
 * the nav area, used to preview the expand icon. The state is cleared whenever `open` changes.
 * Pressing `Escape` while open closes the sidebar and returns focus to the hamburger button.
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ WAI-ARIA Disclosure Pattern}
 */
export class Sidebar extends CustomElementInternals {
    static sheet = sheet;

    @property({
        type: Boolean,
        rerender: true,
        after(this: Sidebar) {
            this._internals.states.delete("hover");
        }
    }) open = false;

    @translate t = useTranslator();

    connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('keydown', this.handleKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.open)
        {
            this.open = false;
            this.shadowRoot?.querySelector<HTMLButtonElement>('pap-button[part="hamburger"]')?.focus();
        }
    }

    @bind
    private handlemouseover() {
        if (this.open) return;
        this._internals.states.add("hover");
    }

    @bind
    private handlemouseleave() {
        if (this.open) return;
        this._internals.states.delete("hover");
    }

    @bind
    private handlenavdivclick() {
        if (this.open) return;
        this.open = true;
    }

    @bind
    private toggle() {
        this.open = !this.open;
    }

    render() {
        return html`
            <pap-tooltip id="menu-btn-tooltip" marker="false" placement="right" instant>${this.open ? this.t("Close sidebar") : this.t("Open sidebar")}</pap-tooltip>
            <div part="panel" role="complementary">
                <div part="container" role="panel">
                    <header part="header">
                        <div>
                            <slot name="header"></slot>
                        </div>
                        <pap-button 
                            slot="target"
                            tabindex="0" 
                            part="hamburger" 
                            size="icon" 
                            variant="clear" 
                            @click="${this.toggle}"
                            aria-label=${this.open ? this.t("Close sidebar") : this.t("Open sidebar")}
                            aria-expanded="${this.open}"
                            popovertarget="menu-btn-tooltip"
                        >
                            <pap-icon aria-hidden="true" name="sidebar"></pap-icon>
                            <pap-icon aria-hidden="true" name="expand"></pap-icon>
                        </pap-button>
                    </header>
                    <nav part="nav" aria-label="Sidebar navigation">
                        <slot></slot>
                        <div 
                            @click="${this.handlenavdivclick}" 
                            @mouseover="${this.handlemouseover}" 
                            @mouseleave="${this.handlemouseleave}"
                            role="button"
                            aria-label="${this.open ? "" : this.t("Open sidebar")}"
                            tabindex="${this.open ? '-1' : '0'}"
                            aria-hidden="${this.open}"
                        ></div>
                    </nav>
                    <footer part="footer">
                        <slot name="footer"></slot>
                    </footer>
                </div>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-sidebar": Sidebar;
    }
}