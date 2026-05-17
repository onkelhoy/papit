// import statements 
// system 
import { bind, CustomElementInternals, html, property, query } from "@papit/web-component";

import { translate, useTranslator } from "@papit/translator";
// local 
import sheet from "./style.css" assert { type: "css" };

type State = Partial<Record<keyof ValidityState, Array<string>>>;
type StateMap = Partial<Record<(keyof ValidityState | (string & {})), string | string[] | (() => string | string[])>>;

/**
 * `Field` is an extensible base class for form field web components.
 *
 * It wraps a native `<input>`, `<textarea>`, or `<select>` (either in the
 * shadow root via `[data-target]` or assigned through the default slot) and
 * handles:
 *
 * - **Error state** — populated on the native `invalid` event, which fires
 *   when browser constraint validation fails (e.g. `required`, `minlength`,
 *   `pattern`, `setCustomValidity`).
 * - **Warning state** — populated on `change` when the field is *valid* but
 *   the consuming code has configured `warning` messages. Warnings are purely
 *   informational and never block form submission.
 * - **Translation fallback chain** — messages resolve in priority order:
 *   explicit prop → field-scoped translation → global translation → raw key.
 *
 * Both `errorState` and `warningState` are exposed as context properties so
 * descendant components can read them without prop-drilling.
 *
 * ### Extending
 * ```ts
 * class MyInput extends Field {
 *   render() {
 *     return html`
 *       <input data-target type="text" name="${this.name}" />
 *       ${this.renderStates()}
 *     `;
 *   }
 * }
 * ```
 *
 * ### Using as a wrapper
 * ```html
 * <pap-field>
 *   <input type="email" name="email" required />
 * </pap-field>
 * ```
 *
 * @element pap-field
 */
export class Field extends CustomElementInternals {

    static sheets = [sheet];

    @property({ type: Object })
    error: StateMap = {}

    @property({ type: Object })
    warning: StateMap = {}

    @property({ type: Object, context: true, rerender: true, reflect: false })
    errorState: State = {}

    @property({ type: Object, context: true, rerender: true, reflect: false })
    warningState: State = {}

    @translate t = useTranslator();

    private get fieldName() {
        return this.getAttribute("name") ?? this.target?.name ?? "";
    }

    private _target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
    protected get target() {
        if (this._target) return this._target;

        const getter = () => {
            const target = this.root.querySelector("[data-target]");
            if (this.isTarget(target))
            {
                return target;
            }

            const input = this.root.querySelector("input");
            if (input) return input;

            const textarea = this.root.querySelector("textarea");
            if (textarea) return textarea;

            const select = this.root.querySelector("select");
            if (select) return select;

            return null;
        }

        this.target = getter();
        return this._target;
    }
    protected set target(value: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) {
        if (this._target)
        {
            // cleanup 
            this._target.removeEventListener("input", this.handlechange);
            this._target.removeEventListener("change", this.handlechange);
            this._target.removeEventListener("invalid", this.handleinvalid);
        }

        this._target = value;

        if (!value) return;

        value.addEventListener("input", this.handlechange);
        value.addEventListener("change", this.handlechange);
        value.addEventListener("invalid", this.handleinvalid);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.target = null; // this will reset 
    }

    customError(message: string | string[]) {
        this.setState(this.errorState, "customError", message);
    }
    customWarning(message: string | string[]) {
        this.setState(this.warningState, "customError", message);
    }

    private setState(state: State, key: keyof ValidityState, message: string | string[]) {

        if (!state[key]) state[key] = [];
        if (Array.isArray(message)) 
        {
            state[key].push(...message);
        }
        else state[key].push(message);
    }

    @bind
    private handleinvalid(e: Event) {
        e.preventDefault();

        if (!this.target) return;

        const { validity } = this.target;
        const newErrors: State = {};

        // no hardcoded array needed — ValidityState properties are enumerable
        for (const name in validity)
        {
            const key = name as keyof ValidityState;
            if (!validity[key] || key === "valid") continue;
            this.setState(newErrors, key, this.resolveMessage(key, "error"))
        }

        this.errorState = newErrors;
        // NOTE: warnings are NOT set here — invalid means form-blocking by definition.
        // warnings get populated via handlechange (non-blocking custom checks)
    }

    @bind
    private handlechange(e: Event) {
        this.errorState = {};

        if (!this.target) return;

        // warnings check on change: only fires when field is actually valid
        if (!this.target.validity.valid) return;

        const newWarnings: State = {};

        for (const name in this.warning)
        {
            const key = name as keyof ValidityState;
            this.setState(newWarnings, key, this.resolveMessage(key, "warning"))
        }

        this.warningState = newWarnings;
    }

    @bind
    private handleslotchange(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        const elements = e.currentTarget.assignedElements();
        for (const element of elements)
        {
            if (this.isTarget(element))
            {
                this.target = element;
                return;
            }
        }
    }

    private resolveMessage(key: keyof ValidityState, mapref: "error" | "warning" = "error"): string | string[] {
        const fieldName = this.fieldName;

        // 1. Explicit error prop (highest priority)
        if (this[mapref][key])
        {
            const val = this[mapref][key];
            return typeof val === "function" ? val() : val!;
        }

        // 2. customError — use validationMessage as the sub-key
        if (key === "customError")
        {
            const customKey = (this.target as HTMLInputElement)?.validationMessage ?? "";

            if (this[mapref][customKey])
            {
                const val = this[mapref][customKey];
                return typeof val === "function" ? val() : val!;
            }

            // field-specific translation
            const specific = this.t(`fields.${fieldName}.${mapref}.${customKey}`);
            if (specific && specific !== `fields.${fieldName}.${mapref}.${customKey}`) return specific;

            // global translation
            const global = this.t(`fields.global.${customKey}`);
            if (global && global !== `fields.global.${customKey}`) return global;

            return customKey;
        }

        // 3. Field-specific translation (e.g. fields.email.error.tooShort)
        const specific = this.t(`fields.${fieldName}.${mapref}.${key}`);
        if (specific && specific !== `fields.${fieldName}.${mapref}.${key}`) return specific;

        // 4. Global translation (e.g. fields.global.tooShort)
        const global = this.t(`fields.global.${key}`);
        if (global && global !== `fields.global.${key}`) return global;

        // 5. Fallback
        return key;
    }

    private isTarget(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
        return false;
    }

    protected renderStates() {
        const errorEntries = Object.entries(this.errorState).flatMap(([key, msg]) => msg.map((m, index) => m));
        const warningEntries = Object.entries(this.warningState).flatMap(([key, msg]) => msg.map((m, index) => m));

        if (!errorEntries.length && !warningEntries.length) return null;


        return html`
            <div part="states">
                ${errorEntries.length ? html`
                    <ul part="errors">
                        ${errorEntries.map(value => html`
                            <li part="error">${value}</li>
                        `)}
                    </ul>
                ` : null}
                ${warningEntries.length ? html`
                    <ul part="warnings">
                        ${warningEntries.map(value => html`
                            <li part="warning">${value}</li>
                        `)}
                    </ul>
                ` : null}
            </div>
        `;
    }

    render() {
        // NOTE this component can both be inherit and also be used as a wrapper
        return html`
            <slot @slotchange="${this.handleslotchange}"></slot>
            ${this.renderStates()}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-field": Field;
    }
}