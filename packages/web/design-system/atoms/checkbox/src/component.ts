// import statements 
// system 
import { bind, CustomElementInternals, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };

/**
 * WAI-ARIA compliant checkbox with indeterminate state and grouped ("select all") selection.
 *
 * @example
 * ```html
 * <pap-checkbox aria-controls="cond1 cond2 cond3">All condiments</pap-checkbox>
 * <pap-checkbox id="cond1">Lettuce</pap-checkbox>
 * <pap-checkbox id="cond2" checked>Tomato</pap-checkbox>
 * <pap-checkbox id="cond3">Mustard</pap-checkbox>
 *
 * <form>
 *   <pap-checkbox name="agree" value="yes" defaultchecked>I agree</pap-checkbox>
 *   <button type="reset">Reset</button>
 * </form>
 * ```
 *
 * @slot - Label content
 *
 * @attr {boolean} checked - Checked state. Reflected as `aria-checked`.
 * @attr {boolean} indeterminate - Mixed state (`aria-checked="mixed"`); cleared on activation, doesn't cascade to `aria-controls` targets.
 * @attr {boolean} defaultchecked - Checked state restored on form reset.
 * @attr {boolean} disabled - Disables interaction and focusability.
 * @attr {boolean} readonly - Blocks state changes, stays focusable.
 * @attr {string} value - Value submitted with the form when checked.
 * @attr {string} aria-controls - Space-separated IDs of checkboxes this one drives as a group (sets them all to match; recomputes from their state when they change).
 *
 * @fires change - On `checked` change via user interaction or direct assignment (not when synced by a controlling group).
 *
 * @csspart marker - The native `<input type="checkbox">` used for form submission.
 *
 * @cssprop [--accent=AccentColor] - Focus outline color.
 * @cssprop [--space-1=0.25rem] - Marker/label gap (currently inactive).
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ WAI-ARIA Checkbox Pattern}
 */
export class Checkbox extends CustomElementInternals {
    static sheet = sheet;

    private controlElements: (HTMLInputElement | Checkbox)[] = [];
    private syncingFromParent = false;
    // True only while THIS checkbox's own checked/indeterminate is being
    // recomputed reactively (from children, or as a side-effect of entering
    // mixed state) — never while it's being genuinely assigned by a user
    // click or external API call. Gates the cascade below.
    private internalRecompute = false;

    @query<HTMLInputElement>({
        selector: "input",
        load(this: Checkbox, element) {
            element.indeterminate = !!this.indeterminate;
            element.checked = !!this.checked;
        }
    }) inputElement!: HTMLInputElement;

    @property({
        attribute: "aria-controls",
        after(this: Checkbox) {
            this.controlElements.forEach(el => el.removeEventListener("change", this.handleControlChange));

            const split = this.controls?.split(" ") ?? [];
            const root = this.getRootNode();
            if (!(root instanceof ShadowRoot || root instanceof Document)) return;

            this.controlElements = [];
            for (const id of split)
            {
                const element = root.getElementById(id);
                if (!element) continue;
                this.controlElements.push(element as HTMLInputElement);
                element.addEventListener("change", this.handleControlChange);
            }
        }
    }) controls?: string;

    @property({
        type: Boolean,
        after(this: Checkbox) {
            if (this.indeterminate)
            {
                // entering mixed state always means "not fully checked" underneath —
                // but this is a side-effect of OUR OWN state, never a command to
                // change the children, so it must never cascade.
                this.internalRecompute = true;
                this.checked = false;
                this.internalRecompute = false;

                this.setAttribute("aria-checked", "mixed");
                if (this.inputElement) this.inputElement.indeterminate = true;
            } else
            {
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
            } else
            {
                this._internals.states.delete("checked");
                this._internals.setFormValue(null);
            }

            // indeterminate still wins the visual/aria display until it's explicitly cleared
            if (!this.indeterminate)
            {
                this.setAttribute("aria-checked", String(!!this.checked));
            }

            if (this.inputElement)
            {
                this.inputElement.checked = !!this.checked;
            }

            if (!this.syncingFromParent)
            {
                this.dispatchEvent(new Event("change"));
            }

            // Cascade to children on any genuine assignment — user click,
            // Space, or external API (`checkbox.checked = false`) — but
            // NOT when this is a reactive recomputation of our own state
            // (handleControlChange, or indeterminate's internal checked=false).
            if (!this.internalRecompute)
            {
                this.controlElements.forEach(el => {
                    if (el instanceof Checkbox)
                    {
                        el.syncingFromParent = true;
                        el.checked = this.checked!;
                        el.syncingFromParent = false;
                    } else
                    {
                        el.checked = this.checked!;
                    }
                });
            }
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

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.controlElements.forEach(el => el.removeEventListener("change", this.handleControlChange));
    }

    public formResetCallback() {
        this.indeterminate = false;
        this.checked = this.defaultChecked ?? false;
    }

    @bind
    private handleControlChange() {
        const checks = this.controlElements.reduce((prev, el) => prev + Number(!!el.checked), 0);

        // this is US reacting to OUR children — never push back down to them
        this.internalRecompute = true;

        if (checks === 0)
        {
            this.indeterminate = false;
            this.checked = false;
        }
        else if (checks === this.controlElements.length)
        {
            this.indeterminate = false;
            this.checked = true;
        }
        else
        {
            this.indeterminate = true;
        }

        this.internalRecompute = false;
    }

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

    // Just decides the target value now — cascading to children happens
    // automatically inside checked's after(), the same way it would for
    // `checkbox.checked = true` called from anywhere else.
    private toggle() {
        if (this.disabled) return;

        if (this.indeterminate)
        {
            this.indeterminate = false;
            this.checked = true;
        }
        else
        {
            this.checked = !this.checked;
        }
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