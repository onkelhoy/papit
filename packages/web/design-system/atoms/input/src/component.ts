// import statements 
// system 
import { bind, html, property, query } from "@papit/web-component";
import { Field } from "@papit/field";

// foundations 
import "@papit/icon";

// local 
import sheet from "./style.css" with { type: "css" };

/**
 * Form-associated input with optional format masking, password visibility toggle, and clear button.
 *
 * @example
 * ```html
 * <pap-input name="phone" format="(xxx) xxx-xxxx"></pap-input>
 * <pap-input type="password" name="secret"></pap-input>
 * <pap-input clear placeholder="Search..."></pap-input>
 * ```
 *
 * @slot prefix - Content before the input
 * @slot sufix - Content after the input
 *
 * @attr {string} type - Native input type (default: "text")
 * @attr {string} format - Mask pattern using `x` as a placeholder, e.g. "xxx-xxx-xxxx"
 * @attr {string | number | Date} value - Current value
 * @attr {string} defaultvalue - Value restored on form reset
 * @attr {boolean} clear - Show a clear button when the value is non-empty
 * @attr {boolean} required - Marks the field as required
 *
 * @fires change - Dispatched whenever the value changes
 *
 * @csspart wrapper - Outer container
 * @csspart input - Native `<input>` element
 * @csspart eye - Password visibility toggle button (only for `type="password"`)
 * @csspart clear - Clear value button (only when `clear` is set)
 */
export class Input extends Field {
    static sheet = sheet;

    // properties 
    private formatCount = 0;
    private originalType!: string;

    @property({
        rerender: true,
        after(this: Input, value, old, initial) {
            if (initial)
            {
                this.originalType = value;
            }
        }
    }) type: "button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week" | "datetime" = "text";
    @property({
        after(this: Input) {
            this.formatCount = this.format?.split(/x/i)?.length ?? 0;
            this.maxlength = this.format?.length;
        }
    })
    format?: string;

    private _cachedValue: string | number | Date | null | undefined = undefined;
    @property({
        reflect: false,
        after(this: Input, value) {
            this.dispatchEvent(new Event("change"));
            this._internals.setFormValue(value ? this.getRaw(value) : null);

            if (this.inputElement) 
            {
                this.inputElement.value = value ?? "";
            }

            this._cachedValue = undefined;
        },
        get(this: Input, value) {
            if (this._cachedValue !== undefined) return this._cachedValue;

            if (!value) 
            {
                this._cachedValue = null;
                return null;
            }

            if (this.type === "number") 
            {
                const ret = this.inputElement.valueAsNumber;
                this._cachedValue = ret;
                return ret;
            }

            if (["date", "datetime"].includes(this.type)) 
            {
                const ret = this.inputElement.valueAsDate;
                this._cachedValue = ret;
                return ret;
            }

            const ret = this.getRaw(value);
            this._cachedValue = ret;
            return ret;
        }
    }) value: string | number | Date | null = null;

    @property({
        attribute: "defaultvalue",
        after(this: Input, value, old, initial) {

            if (initial || !this.value)
            {
                this.value = value;
            }
            if (!this.inputElement) return;
            this.inputElement.defaultValue = value;
        },

    }) defaultValue?: string;

    @property({ type: Number, rerender: true, reflect: false }) maxlength?: number;
    @property({ type: Number, rerender: true, reflect: false }) minlength?: number;
    @property({ type: Number, rerender: true, reflect: false }) min?: number;
    @property({ type: Number, rerender: true, reflect: false }) max?: number;
    @property({ rerender: true, reflect: false }) pattern?: string;
    @property({ rerender: true, reflect: false }) accept?: string;
    @property({ rerender: true, reflect: false }) placeholder?: string;
    @property({ rerender: true, reflect: false }) autocomplete: "on" | "off" | (string & {}) = "on";
    @property({ rerender: true, reflect: false }) name?: string;
    @property({ type: Boolean, rerender: true, reflect: false }) clear: boolean = false;
    @property({ type: Boolean, rerender: true, reflect: false }) required: boolean = false;

    @query<HTMLInputElement>({
        selector: "input",
        load(this: Input, element) {
            this.target = element;

            if (this.value)
            {
                this.target.value = this.getFormat(String(this.value));
            }
            if (this.defaultValue)
            {
                this.target.defaultValue = this.defaultValue;
            }
        }
    }) inputElement!: HTMLInputElement;

    constructor() {
        super({
            delegatesFocus: true
        })
    }

    protected override formAssociatedCallback(form: HTMLFormElement) {
        super.formAssociatedCallback(form);

        // Listen to form reset event
        form?.addEventListener('reset', this.handleFormReset);
    }


    // event handlers 
    @bind
    private handleFormReset() {
        if (this.defaultValue)
        {
            this.value = this.defaultValue;
        }
        else 
        {
            this.value = "";
        }

        this.syncValidity();
    }

    @bind
    private handleInput(e: InputEvent) {

        const el = this.inputElement;

        if (!this.format || !["text", "number", "password"].includes(this.type)) 
        {
            this.setValue(el.value);
            if (this.clear) this.requestUpdate();
            return;
        }

        const cursorPos = el.selectionStart ?? el.value.length;

        // single-char insert: protect it from being mistaken for a literal,
        // even if it happens to equal one
        const protectedIndex = e.inputType.startsWith("insert") && e.data?.length === 1
            ? cursorPos - 1
            : undefined;

        const rawBeforeCursor = this.getRaw(el.value.slice(0, cursorPos), protectedIndex).length;

        const raw = this.getRaw(el.value, protectedIndex).slice(0, this.formatCount);
        const formatted = this.getFormat(raw);
        this.value = formatted;

        let newPos = 0, consumed = 0;
        while (consumed < rawBeforeCursor && newPos < formatted.length)
        {
            if (/x/i.test(this.format[newPos])) consumed++;
            newPos++;
        }

        requestAnimationFrame(() => el.setSelectionRange(newPos, newPos));
        if (this.clear) this.requestUpdate();
    }

    @bind
    private handleClear() {
        this.inputElement.value = "";
        this.dispatchEvent(new Event("change"));
        this.requestUpdate();
    }

    @bind
    private handleEye() {
        if (this.type === "password") this.type = "text";
        else this.type = "password";
    }

    render() {
        return html`
            <div part="wrapper">
                <slot name="prefix"></slot>
                <input 
                    minlength="${this.minlength ?? ""}"
                    maxlength="${this.maxlength ?? ""}"
                    min="${this.min ?? ""}"
                    max="${this.max ?? ""}"
                    placeholder="${this.placeholder ?? ""}"
                    accept="${this.accept ?? ""}"
                    pattern="${this.pattern ?? ""}"
                    type="${this.type}"
                    name="${this.name ?? ""}"
                    part="input"
                    @input="${this.handleInput}"
                    autocomplete="${this.autocomplete === "off" ? "new-password" as any : this.autocomplete}"
                    ${this.disabled ? "disabled" : ""}
                    ${this.required ? "required" : ""}
                />
                <slot name="sufix"></slot>

                ${this.originalType === "password" && html`
                    <button part="eye" @click="${this.handleEye}">
                        <pap-icon name="${this.type === "password" ? "eye" : "eye-closed"}"></pap-icon>    
                    </button>
                `}

                ${this.clear && String(this.value ?? "").length > 0 && html`
                    <button part="clear" @click="${this.handleClear}">
                        <pap-icon name="clear-filled"></pap-icon>
                    </button>
                `}
            </div>
            ${this.renderStates()}
        `
    }

    // helper functions 

    private getFormat(value: string | null) {
        if (!value) return "";
        const raw = this.getRaw(value);
        if (!this.format) return raw;

        let output = "";
        let ri = 0;
        for (let fi = 0; fi < this.format.length && ri < raw.length; fi++)
        {
            output += /x/i.test(this.format[fi]) ? raw[ri++] : this.format[fi];
        }
        return output;
    }

    private getRaw(value: string, protectedIndex?: number) {
        if (!this.format) return value;

        let raw = "";
        let fi = 0;

        for (let i = 0; i < value.length; i++)
        {
            const ch = value[i];
            const expected = this.format[fi];
            const isProtected = i === protectedIndex; // just typed by the user, never a literal

            if (!isProtected && fi < this.format.length && !/x/i.test(expected) && expected === ch)
            {
                fi++;
                continue;
            }

            raw += ch;
            if (fi < this.format.length && /x/i.test(expected)) fi++;
        }

        return raw;
    }

    private setValue(value: string) {
        this.value = value;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-input": Input;
    }
}