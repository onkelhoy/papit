// import statements 
// system 
import { CustomElement, html, property } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };

/**
 * Positions its content on a side of an anchor with CSS anchor positioning.
 * Point it at an anchor with `--anchor-name` (or `position-anchor` directly).
 *
 * @element pap-placement
 * @slot - the floating content
 * @slot marker - custom marker content
 * @csspart marker - wrapper around the marker slot
 * @cssprop [--anchor-name=--anchor] - The CSS anchor name to position against.
 * @cssprop [--gap=var(--space-2)] - Distance between the anchor and the box.
 */


export class Placement extends CustomElement {
    static sheets = [sheet];

    /**
     * Controls the preferred placement of the element relative to its anchor.
     *
     * Single-axis values (`"top"`, `"bottom"`, `"left"`, `"right"`) resolve
     * to their centered variant, e.g. `"bottom"` behaves as `"bottom-center"`.
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