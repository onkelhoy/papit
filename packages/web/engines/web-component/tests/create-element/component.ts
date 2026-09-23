import { CustomElementInternals, html, property, context } from "@papit/web-component";

// fixture: defaults that reflect (string, number, boolean kept as "false"),
// one mirrored to aria, one removed when false, and a context consumer
class CreateFixture extends CustomElementInternals {
    @property variant = "filled";
    @property({ type: Number }) size = 3;
    @property({ type: Boolean, aria: "aria-pressed", removeAttribute: false }) pressed = false;
    @property({ type: Boolean }) flag = false;
    @context({ applyattribute: true }) hello = "";

    render() {
        return html`<span>${this.variant}</span>`;
    }
}

customElements.define("create-fixture", CreateFixture);
