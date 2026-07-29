// import statements 
// system 
import { bind, CustomElementInternals, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };


/**
 * A WAI-ARIA compliant checkbox web component with support for the
 * indeterminate ("mixed") state.
 *
 * Follows the [Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
 * spec. Activated via click or Space; `aria-checked` reflects `true`,
 * `false`, or `mixed`.
 *
 * @element pap-checkbox
 *
 * @attr {boolean} checked        - Whether the checkbox is currently checked.
 *                                  Reflected as `aria-checked`.
 * @attr {boolean} indeterminate  - Puts the checkbox in the mixed state.
 *                                  Reflected as `aria-checked="mixed"`; cleared
 *                                  automatically once the checkbox is activated.
 * @attr {boolean} defaultchecked - The checked state to restore on form reset.
 * @attr {boolean} disabled       - Disables interaction and focusability.
 * @attr {boolean} readonly       - Prevents state changes while keeping focusable.
 * @attr {string}  value          - The value submitted with the form when checked.
 *
 * @fires change - Dispatched whenever `checked` changes.
 *
 * @slot - Label text or elements placed to the right of the checkbox marker.
 *
 * @csspart marker - The native `<input type="checkbox">` used for form submission.
 *
 * @cssprop [--space-1=0.25rem] - Gap between marker and label; also outline offset.
 * @cssprop [--space-5=1.25rem] - Marker width and height.
 * @cssprop [--info]            - Fill colour of the marker when checked or mixed.
 * @cssprop [--accent=currentColor] - Accent colour (currently reserved for future use).
 *
 * @example
 * <!-- Standalone -->
 * <pap-checkbox>Subscribe to newsletter</pap-checkbox>
 * <pap-checkbox defaultchecked>Accept terms</pap-checkbox>
 *
 * @example
 * <!-- Indeterminate (e.g. "select all" controlling a partial selection) -->
 * <pap-checkbox id="select-all" indeterminate>Select all</pap-checkbox>
 *
 * @example
 * <!-- Inside a form -->
 * <form>
 *   <pap-checkbox name="agree" value="yes">I agree</pap-checkbox>
 *   <button type="reset">Reset</button>
 * </form>
 */
export class Checkbox extends CustomElementInternals {
    static sheet = sheet;

    // constructor() {
    //     super({ delegatesFocus: true });
    // }

    @query<HTMLInputElement>({
        selector: "input",
        load(this: Checkbox, element) {
            if (this.indeterminate)
            {
                element.indeterminate = true;
            }
        }
    }) inputElement!: HTMLInputElement;

    @property({
        type: Boolean,

        after(this: Checkbox) {
            if (this.indeterminate)
            {
                this.checked = false;
                this.setAttribute("aria-checked", "mixed");
                this._internals.setFormValue(null);
                if (this.inputElement) this.inputElement.indeterminate = true;
            }
            else
            {
                // leaving the mixed state: fall back to whatever `checked` actually is
                this.setAttribute("aria-checked", String(!!this.checked));
                if (this.inputElement) this.inputElement.indeterminate = false;
            }
        }
    }) indeterminate?: boolean;

    @property({
        type: Boolean,
        after(this: Checkbox, value, old, initial) {
            if (!initial && this.disabled) return;

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

            // indeterminate always wins visually/semantically until explicitly cleared
            if (!this.indeterminate)
            {
                this.setAttribute("aria-checked", String(!!this.checked));
            }

            if (this.inputElement)
            {
                this.inputElement.indeterminate = !!this.indeterminate;
                this.inputElement.checked = !!this.checked;
            }

            this.dispatchEvent(new Event("change"));
        },

        set(value: any) {
            if (value === "indeterminate") return "indeterminate";
            return Boolean(value);
        },

    }) checked?: boolean;

    @property({
        attribute: "defaultchecked",
        type: Boolean,
        after(this: Checkbox, value: boolean | undefined, old, initial) {
            if (initial)
            {
                this.checked = value !== undefined && value !== false;
            }
        }
    }) defaultChecked?: boolean;

    @property({
        type: Boolean,
        after(this: Checkbox, value: boolean | undefined) {
            // keep the host out of the tab order while disabled, per APG
            if (value)
            {
                this.setAttribute("aria-disabled", "true");
                this.removeAttribute("tabindex");
            }
            else
            {
                this.setAttribute("aria-disabled", "false");
                if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
            }
        }
    }) disabled!: boolean;

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "checkbox");
        this.setAttribute("aria-checked", this.indeterminate ? "mixed" : String(!!this.checked));

        if (!this.disabled && !this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
        if (this.hasAttribute("readonly")) this.setAttribute("aria-readonly", "true");

        this.addEventListener("click", this.handleclick);
        this.addEventListener("keydown", this.handlekeydown);
        this.addEventListener("keyup", this.handlekeyup);
    }

    // form events
    public formResetCallback() {
        this.indeterminate = false;
        this.checked = this.defaultChecked ?? false;
    }

    // event handlers 
    @bind
    private handleclick() {
        if (this.disabled) return;
        if (this.hasAttribute("readonly")) return;

        this.toggle();
    }

    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (this.disabled) return;
        if (this.hasAttribute("readonly")) return;

        // APG: only Space activates a checkbox, Enter is not used
        if (e.key === " ")
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

        if (e.key === " ")
        {
            e.preventDefault();
            this.toggle();
        }
    }

    private toggle() {
        if (this.disabled) return;

        // per APG, activating a mixed checkbox moves it to checked
        if (this.indeterminate)
        {
            this.indeterminate = false;
            this.checked = true;
            return;
        }

        this.checked = !this.checked;
    }

    render() {
        return html`
            <input ${this.checked && "checked"} type="checkbox" part="marker" tabindex="-1" />
            <slot></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-checkbox": Checkbox;
    }
}