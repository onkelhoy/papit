import { CustomElement, property, query } from "@papit/web-component";
import { translate, useTranslator } from "@papit/translator";

export class Plain extends CustomElement {
    @query("span") span!: HTMLSpanElement;

    @translate({ scope: "plain" }) t = useTranslator();

    @property() selector = ["h1", "h2"].join(",");

    public pick<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] | null {
        return this.querySelector(tag);
    }

    public notify() {
        this.dispatchEvent(new CustomEvent("picked", { detail: { count: 1, tag: "h1" } }));
    }

    render() {
        return "<slot></slot>";
    }
}
