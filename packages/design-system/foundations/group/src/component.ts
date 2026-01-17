// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };
import { ClickEvent } from "./types";

console.log('what the hell is sheet?, weird-- ok BAJS åsna FK', sheet)

export class Group extends CustomElement {
    static sheet = sheet;

    // properties 
    @property({ type: Boolean }) foo: boolean = false;

    // event handlers
    private handleclick = () => {
        this.dispatchEvent(new CustomEvent<ClickEvent>("main-click", { detail: { timestamp: performance.now() } }));
    }

    render() {
        return html`
            <p @click="${this.handleclick}">Llama Trauma Baby Mama</p>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-group": Group;
    }
}