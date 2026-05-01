// import statements 
// system 
import { bind, context, CustomElement, generateUUID, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

// foundations
import "@papit/button";
import "@papit/icon";

import { Accordion } from "component";

export class AccordionHeader extends CustomElement {
    static sheet = sheet;

    private internal = false;
    private accordion: Accordion | null = null;

    @query("pap-button") button!: HTMLButtonElement;

    @property({ type: Number, attribute: "aria-level" }) level = 3;
    @property({
        type: Boolean,
        after(this: AccordionHeader) {
            this.internal = true;

            if (!this.button) return;

            this.button.setAttribute("aria-expanded", String(this.open));

            // panels will have context pointing to this open state 
            const region = this.closest("[role=\"region\"]");
            if (region)
            {
                region.setAttribute("open", String(this.open))
            }
            else if (this.accordion)
            {
                this.accordion.setAttribute("open", String(this.open))
            }

            if (!this.accordion) return;
            const values = this.accordion.value.filter((v: string) => v !== this.id);
            if (this.open) values.push(this.id);

            this.accordion.value = values;
        }
    }) open = false;
    @property({
        after(this: AccordionHeader, value: string) {
            if (!this.button) return;
            this.button.setAttribute("aria-controls", value);
        }
    }) controls: string = "";

    @context({
        update(this: AccordionHeader, value: string[]) {
            if (this.internal) return void (this.internal = false);
            this.open = value.includes(this.id);
        }
    }) value: string[] = [];
    @context({
        name: "disabled",
        attribute: "area-disabled",
        applyattribute: true,
    }) disabled = false;

    connectedCallback(): void {
        super.connectedCallback();

        this.setAttribute("role", "heading");
        this.setAttribute("tabindex", "0");
        this.addEventListener("keydown", this.handlekeydown);

        this.id = this.id || generateUUID();
        this.accordion = this.closest<Accordion>("pap-accordion"); // this.closest("region") ?? 

        const region = this.closest('[role="region"]');
        const target = region ?? this.accordion;
        if (target && !target.hasAttribute("open"))
        {
            target.setAttribute("open", "false");
        }

        queueMicrotask(() => {
            this.setup();
        })
    }

    private setup() {
        const region = this.closest("[role=\"region\"]");
        if (region) region.setAttribute("aria-labelledby", this.id + "-button");

        const target = region ?? this.accordion;
        if (!target) return;

        // ensure the container has an id
        if (!target.id) target.id = generateUUID();
        this.controls = target.id;
        this.requestUpdate();
    }

    @bind
    toggle() {
        this.open = !this.open;
    }

    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (/ /.test(e.key) || /enter/i.test(e.key))
        {
            this.open = !this.open;
            e.preventDefault();
        }
    }

    render() {
        return html`
            <pap-button 
                ${this.disabled && "disabled" as any}
                aria-expanded="${this.open ? "true" : "false"}" 
                aria-controls="${this.controls ?? ""}"
                variant="clear"
                tabindex="-1"
                color="secondary"
                part="button"
                id="${this.id + "-button"}"
                @click="${this.toggle}"
            >
                <pap-icon part="marker" name="caret-down"></pap-icon>
                <slot></slot>
            </pap-button>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-accordion-header": AccordionHeader;
    }
}