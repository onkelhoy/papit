// import statements 
// system 
import { bind, CustomElementInternals, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };

/**
 * A WAI-ARIA compliant radio button web component.
 *
 * Follows the [Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
 * spec. Arrow-key navigation, roving tabindex, and mutual exclusion within a
 * named group are handled at the individual radio level.
 *
 * @element pap-radio
 *
 * @attr {string}  name           - Groups radios for mutual exclusion and arrow-key
 *                                  navigation. Mirrors the native `name` attribute.
 * @attr {boolean} checked        - Whether this radio is currently selected.
 *                                  Reflected as `aria-checked`.
 * @attr {boolean} defaultchecked - The checked state to restore on form reset.
 * @attr {boolean} disabled       - Disables interaction and focusability.
 * @attr {boolean} readonly       - Prevents state changes while keeping focusable.
 * @attr {string}  value          - The value submitted with the form when checked.
 *
 * @fires change - Dispatched whenever `checked` changes.
 *
 * @slot - Label text or elements placed to the right of the radio marker.
 *
 * @csspart marker - The circular indicator element.
 *
 * @cssprop [--space-1=0.25rem] - Gap between marker and label; also outline offset.
 * @cssprop [--space-5=1.25rem] - Marker width and height.
 * @cssprop [--info]            - Fill colour of the inner dot when checked.
 * @cssprop [--accent=currentColor] - Accent colour (currently reserved for future use).
 *
 * @example
 * <!-- Standalone -->
 * <pap-radio name="plan" value="free">Free</pap-radio>
 * <pap-radio name="plan" value="pro" defaultchecked>Pro</pap-radio>
 *
 * @example
 * <!-- Inside pap-group for orientation / layout -->
 * <pap-group aria-orientation="vertical">
 *   <pap-radio name="size" value="s">Small</pap-radio>
 *   <pap-radio name="size" value="m">Medium</pap-radio>
 *   <pap-radio name="size" value="l">Large</pap-radio>
 * </pap-group>
 *
 * @example
 * <!-- Inside a form -->
 * <form>
 *   <pap-radio name="agree" value="yes">Yes</pap-radio>
 *   <pap-radio name="agree" value="no">No</pap-radio>
 *   <button type="reset">Reset</button>
 * </form>
 */
export class Radio extends CustomElementInternals {
    static sheet = sheet;

    private static checkedMap = new Map<string, Radio>();

    constructor() {
        super({ delegatesFocus: true });
    }

    @property({
        type: Boolean,
        aria: "aria-checked",
        after(this: Radio, value, old, initial) {
            if (!initial && this.disabled) return;

            const name = this.getAttribute("name");

            if (name && this.checked) 
            {
                const other = Radio.checkedMap.get(name);
                if (other) other.checked = false;
                Radio.checkedMap.set(name, this);
            }

            if (this.checked)
            {
                this._internals.states.add("checked");
                this._internals.setFormValue(this.getAttribute("value"));
            }
            else 
            {
                this._internals.states.delete("checked");
                this._internals.setFormValue(null);
            }

            this.dispatchEvent(new Event("change"));
        }
    }) checked?: boolean;

    @property({
        attribute: "defaultchecked",
        type: Boolean,
        after(this: Radio, value: boolean | undefined, old, initial) {
            if (initial)
            {
                this.checked = value !== undefined && value !== false;
            }
        }
    }) defaultChecked?: boolean;

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "radio");
        // if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");

        this.addEventListener("click", this.handleclick);
        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("keyup", this.handlekeyup);
        this.setAttribute("aria-checked", String(this.checked ?? false));
    }

    // form events
    public formResetCallback() {
        if (this.defaultChecked === undefined) return;

        this.checked = this.defaultChecked;
    }

    // event handlers 
    @bind
    private handleclick() {
        if (this.hasAttribute("readonly")) return;
        this.select();
    }
    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (this.disabled) return;
        if (this.hasAttribute("readonly")) return;

        if (/Enter/i.test(e.key) || e.key === " ")
        {
            e.preventDefault();
            this._internals.states.add("active");
        }
    }
    @bind
    private handlekeyup(e: KeyboardEvent) {
        if (this.disabled) return;
        if (this.hasAttribute("readonly")) return;

        if (this._internals.states.has("active")) this._internals.states.delete("active");
        if (/Enter/i.test(e.key) || e.key === " ")
        {
            e.preventDefault();
            this.select();
        }
    }

    private select() {
        if (this.disabled) return;
        if (this.checked) return;
        this.checked = true;
    }

    render() {
        return html`
            <div part="marker" tabindex="0"></div>
            <slot></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-radio": Radio;
    }
}