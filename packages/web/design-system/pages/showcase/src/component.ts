// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// foundations  
import "@papit/icon";

// molecules
import "@papit/theme-picker";
import "@papit/sidebar";

// tools 
import "@papit/router";

// local 
import sheet from "./style.css" with { type: "css" };
import { translate, useTranslator } from "@papit/translator";

export class Showcase extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator();
    @property({ type: Boolean, rerender: true }) hashbased = true;

    render() {
        return html`
            <header>
                <pap-theme-picker></pap-theme-picker>
            </header>
            <pap-sidebar>
                <strong slot="header">${this.t("sidebar.title")}</strong>
                <pap-icon slot="header" name="logo"></pap-icon>
                <slot name="sidebar"></slot>
            </pap-sidebar>
            <article>
                <pap-router hash-based="${this.hashbased}">
                    <slot name="path">
                        <div 
                            path="/:level/:package/:view" 
                            realpath="/packages/web/design-system/:level/:package/views/:view/"
                            view="raw"
                            view-fallback="experiment"
                            package="button"
                            level="1-foundations"
                        ></div>
                    </slot>
                </pap-router>
            </article>
            <footer>
                <slot name="footer"></slot>
            </footer>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase": Showcase;
    }
}