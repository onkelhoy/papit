import { CustomElementInternals, html, property, context } from "@papit/web-component";

// fixture: defaults that reflect (string, number, boolean kept as "false"),
// one mirrored to aria, one removed when false, a context consumer and
// an after hook that writes attributes without setAttribute
class CreateFixture extends CustomElementInternals {
    @property variant = "filled";
    @property({ type: Number }) size = 3;
    @property({ type: Boolean, aria: "aria-pressed", removeAttribute: false }) pressed = false;
    @property({ type: Boolean }) flag = false;
    @context({ applyattribute: true }) hello = "";

    afterCalls: Array<{ value: number, old: number | undefined, initial: boolean }> = [];
    @property({
        type: Number,
        attribute: false,
        after(this: CreateFixture, value: number, old: number | undefined, initial: boolean) {
            this.afterCalls.push({ value, old, initial });
            this.style.setProperty("--duration", `${value}ms`);
            this.classList.add("styled");
        }
    }) duration = 5000;

    render() {
        return html`<span>${this.variant}</span>`;
    }
}

customElements.define("create-fixture", CreateFixture);
