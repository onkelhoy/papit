import { CustomElement, html, property, query } from "@papit/web-component";

const sheet = new CSSStyleSheet();
sheet.replaceSync(":host { display: block; }");

// renders nothing until `show`, then a template that updates in place
class RenderToggle extends CustomElement {
    static sheet = sheet;

    @property({ type: Boolean, rerender: true }) show = false;
    @property({ rerender: true }) label = "hello";
    @query("p") text!: HTMLParagraphElement | null;

    firstRenders = 0;

    firstRender(): void {
        super.firstRender();
        this.firstRenders++;
    }

    render() {
        if (!this.show) return null;
        return html`<p>${this.label}</p>`;
    }
}

// two different templates from two call sites
class RenderSwap extends CustomElement {
    @property({ rerender: true }) mode: "a" | "b" = "a";
    @property({ rerender: true }) label = "first";

    clicks = 0;

    private handleclick = () => { this.clicks++; };

    render() {
        if (this.mode === "a") return html`<p data-mode="a">${this.label}</p>`;
        return html`<button data-mode="b" @click="${this.handleclick}">${this.label}</button>`;
    }
}

// light DOM: the author's own children must survive a render going away
class RenderLight extends CustomElement {
    @property({ type: Boolean, rerender: true }) show = true;

    constructor() {
        super({ lightDOM: true });
    }

    render() {
        if (!this.show) return null;
        return html`<span data-rendered>rendered</span>`;
    }
}

customElements.define("render-toggle", RenderToggle);
customElements.define("render-swap", RenderSwap);
customElements.define("render-light", RenderLight);
