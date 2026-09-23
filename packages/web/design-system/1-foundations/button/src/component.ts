// import statements 
// system 
import { bind, CustomElementInternals, property } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };
import type { ButtonColor } from "./types";

export class Button extends CustomElementInternals {
    static sheet = sheet;

    // properties 
    @property href?: string;
    @property variant: "outline" | "clear" | "filled" = "filled";
    @property size: "small" | "medium" | "large" | "icon" = "medium";
    @property color: ButtonColor = "primary";

    connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute("role", "button");
        if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");

        this.addEventListener("click", this.handleclick, true);
        this.addEventListener('keydown', this.handlekeydown);
        this.addEventListener('keyup', this.handlekeyup);
        this.addEventListener("focusout", this.handlefocusout);
    }

    // WAI-ARIA button pattern: Enter and Space both activate; Space fires on keyup
    // and its keydown is prevented so the page does not scroll
    @bind
    private handlekeydown(e: KeyboardEvent) {
        if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;

        const key = keyname(e);
        if (key === "space") e.preventDefault();
        if (key === "space" || key === "enter" || key === "numpadenter")
        {
            this._internals.states.add("active");
        }
    }

    @bind
    private handlekeyup(e: KeyboardEvent) {
        if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;

        const key = keyname(e);
        if (key === "space" || key === "enter" || key === "numpadenter")
        {
            if (!this._internals.states.has("active")) return;
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

function keyname(e: KeyboardEvent) {
    if (e.key === " " || e.code === "Space") return "space";
    return (e.key || e.code).toLowerCase();
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-button": Button;
    }
}