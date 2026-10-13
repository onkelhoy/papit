import { FixtureBase } from "./base";
import { property } from "./decorators";

type Item = { id: number };
type Tone = "info" | "warn";

/**
 * Fixture element for the react tests.
 * @fires change - whenever `open` toggles
 */
export class Fixture extends FixtureBase {
    /** Text shown in the header. */
    @property({ attribute: "label-text" }) label: string = "hello";
    @property({ type: Boolean }) open: boolean = false;
    @property() variant: "small" | "large" | (string & {}) = "small";
    @property({ readonly: true }) size: number = 1;
    /** Rows to render. */
    @property({ type: Array }) items: Item[] = [];
    @property({ attribute: false }) count: number = 0;
    /** An alias of literals: a primitive once resolved. */
    @property() tone: Tone = "info";
    @property() when: string | number | Date | null = null;
    /** Renamed to an attribute that is neither standard nor hyphenated. */
    @property({ type: Boolean, attribute: "click" }) withClick: boolean = false;

    /** Plain field without @property: not a prop. */
    internal: number = 0;

    public toggle() {
        this.open = !this.open;
        this.dispatchEvent(new Event("change"));
        this.dispatchEvent(new CustomEvent<{ value: string }>("value-change", { detail: { value: this.label } }));
        this.dispatchEvent(new CustomEvent<Item>("tab-select", { detail: { id: 1 } }));
    }
}

export class FixtureItem extends FixtureBase {
    @property() value: string = "";
}
