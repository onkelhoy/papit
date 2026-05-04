// import statements 
// system 
import { bind, context, CustomElement, generateUUID, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

export class AccordionPanel extends CustomElement {
    static sheet = sheet;


    @context({ attribute: "open", applyattribute: true }) open: "true" | "false" = "false";

    connectedCallback(): void {
        super.connectedCallback();
        this.id = this.id || generateUUID();
    }

    render() {
        return "<div><slot></slot></div>";
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-accordion-panel": AccordionPanel;
    }
}