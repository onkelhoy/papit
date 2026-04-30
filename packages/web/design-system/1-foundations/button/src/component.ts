// import statements 
// system 
import { bind, CustomElementInternals, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

export class Button extends CustomElementInternals {
    static sheet = sheet;

    // properties 
    @property href?: string;
    @property variant: "outline" | "clear" | "filled" = "filled";
    @property size: "small" | "medium" | "large" | "icon" = "medium";
    @property color: "primary" | "secondary" | "tiertery" | "success" | "warning" | "error" | "information" = "primary";

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "button");
        this.setAttribute("tabindex", "0");

        this.addEventListener("click", this.handleclick, true);
        this.addEventListener('keydown', this.handlekeydown);
        this.addEventListener('keyup', this.handlekeyup);
        this.addEventListener("focusout", this.handlefocusout);
    }

    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;
        if (["enter", "numpadenter"].includes((e.key || e.code).toLowerCase()))
        {
            this._internals.states.add("active");
        }
    }

    @bind
    private handlekeyup(e: KeyboardEvent) {
        if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;
        if (["enter", "numpadenter"].includes((e.key || e.code).toLowerCase()))
        {
            this._internals.states.delete("active");
            this.click();
        }
    }
    @bind
    private handleclick(e: Event) {
        if (this.hasAttribute("disabled") || this.hasAttribute("readonly"))
        {
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        if (this.href)
        {
            window.location.href = this.href;
        }
        else
        {
            const form = this._internals.form ?? this.closest("form");
            if (!form) return;

            const type = this.getAttribute("type");
            if (type === "submit") form.requestSubmit();
            else if (type === "reset") form.reset();
        }
    }

    @bind
    private handlefocusout() {
        this._internals.states.delete("active");
    }

    render() {
        return "<slot></slot>"
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-button": Button;
    }
}