import { CustomElementInternals, html, property } from "@papit/web-component";

import sheet from "./style.css" with { type: "css" };

/**
 * Fixture element for the analyse tests.
 * @element pap-fixture
 * @fires {CustomEvent<{ open: boolean }>} toggle - Fired when opened.
 * @cssprop [--fixture-gap=4px] - Gap between items.
 */
export class Fixture extends CustomElementInternals {
    static sheet = sheet;

    /** Text shown in the label. */
    @property({ type: String, attribute: "label-text", reflect: true }) label: string = "hello";
    /** Closes on a backdrop click. */
    @property({ type: Boolean, attribute: "close-outside-click" }) protected closeoutsideclick = false;
    @property({ type: Boolean, attribute: false }) protected busy = false;
    @property({ type: Number }) private value: number = 50;
    protected plain = 0;

    /** Opens the fixture and tells listeners. */
    public open() {
        this.dispatchEvent(new CustomEvent("toggle", { detail: { open: true } }));
    }

    public find(selector: string): Element | null;
    public find(selector: string, all: true): Element[];
    public find(selector: string, all?: boolean) {
        return all ? [] : null;
    }

    render() {
        return html`
            <span part="label">${this.label}</span>
            <slot name="icon"></slot>
            <slot></slot>
        `;
    }
}
