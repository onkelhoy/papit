import { CustomElement, property } from "@papit/web-component";

import type { Size } from "./types";

type Color = "primary" | "secondary";
type Item = { id: number };

interface Layout {
    mode: "row" | "column";
}

export class Resolved extends CustomElement {
    @property() color: Color = "primary";
    @property() mode: Layout["mode"] = "row";
    @property() size: Size = "small";
    @property() label: string = "";
    @property({ type: Array }) items: Item[] = [];

    /** Plain field without @property: not a prop. */
    note: string = "";

    /**
     * Spans two lines,
     * and mentions @fires mid-text.
     * @deprecated use `note`
     */
    hint: string = "";
}
