// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

/**
 * `Placement` is a helper component that handles automatic repositioning
 * using the CSS `@position-try` rule.
 *
 * Requires an anchor to be set via the CSS custom property `--anchor-name`
 * (e.g. `--anchor-name: --my-anchor`), or by overriding the `position-anchor`
 * rule entirely. All repositioning logic is then handled automatically.
 *
 * @element pap-placement
 *
 * @cssprop [--anchor-name=--anchor] - The CSS anchor name to position against.
 */


export class Placement extends CustomElement {
    static sheets = [sheet];

    /**
     * Controls the preferred placement of the element relative to its anchor.
     *
     * - Single-axis values (`"top"`, `"bottom"`, `"left"`, `"right"`) resolve
     *   to their centered variant — e.g. `"bottom"` behaves as `"bottom-center"`.
     * - The component will automatically fall back to other placements if the
     *   preferred one does not fit the viewport.
     *
     * @default "bottom"
     */
    @property placement:
        | "top" | "bottom" | "left" | "right"
        | "top-left" | "top-right" | "top-center"
        | "bottom-left" | "bottom-right" | "bottom-center"
        | "left-top" | "left-bottom" | "left-center"
        | "right-top" | "right-bottom" | "right-center" = "bottom";


    render() {
        return html`
            <slot></slot>
            <span part="marker"><slot name="marker"></slot></span>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-placement": Placement;
    }
}