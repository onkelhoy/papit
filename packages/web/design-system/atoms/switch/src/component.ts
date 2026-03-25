// import statements 
// system 
import { bind, CustomElementInternals, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * Accessible toggle switch web component.
 *
 * Implements the ARIA **Switch Pattern** and behaves similarly to a native
 * checkbox, but visually represents a binary on/off toggle.
 *
 * The component:
 * - exposes `role="switch"` and manages `aria-checked`
 * - supports keyboard interaction (`Space` and `Enter`)
 * - participates in HTML forms using `ElementInternals`
 * - dispatches a native `change` event when the state changes
 *
 * When `checked` is `true`, the component:
 * - adds the internal `checked` state
 * - submits `"true"` as its form value
 *
 * When `checked` is `false`, the component:
 * - removes the `checked` state
 * - submits no value (`null`) to the form
 *
 * Keyboard interaction:
 * - `Space` or `Enter` toggles the switch
 * - `keydown` sets an internal `active` state for styling
 * - `keyup` removes the `active` state and triggers the toggle
 *
 * The switch respects the following attributes:
 * - `disabled` — prevents interaction
 * - `readonly` — prevents toggling but keeps focusability
 * - `defaultchecked` — initial checked state used during form reset
 *
 * @element pap-switch
 *
 * @property {boolean} checked
 * Current state of the switch.
 *
 * @property {boolean} defaultChecked
 * Initial checked state used when a parent form is reset.
 *
 * @fires change
 * Fired whenever the checked state changes.
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/switch/ Switch Pattern}
 */
export class Switch extends CustomElementInternals {
    static sheet = sheet;

    @property({
        type: Boolean,
        after(this: Switch, value, old, initial) {
            if (!initial && this.disabled) return;
            this.setAttribute("aria-checked", String(this.checked));

            if (this.checked)
            {
                this._internals.states.add("checked");
                this._internals.setFormValue("true");
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
        after(this: Switch, value: boolean | undefined, old, initial) {
            if (initial)
            {
                this.checked = value !== undefined && value !== false;
            }
        }
    }) defaultChecked?: boolean;

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "switch");
        if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");

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
        this.toggle();
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
            this.toggle();
        }
    }

    private toggle() {
        if (this.disabled) return;
        this.checked = !this.checked;
    }

    render() {
        return ""
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-switch": Switch;
    }
}