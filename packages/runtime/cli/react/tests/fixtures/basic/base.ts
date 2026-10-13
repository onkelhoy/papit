import { property } from "./decorators";

export class FixtureBase extends HTMLElement {
    @property({ type: Boolean }) disabled: boolean = false;

    connectedCallback() {
        this.dispatchEvent(new Event("ready"));
    }
}
