// import statements
// system
import { bind, context, CustomElement, html, query } from "@papit/web-component";
import { translate, useTranslator } from "@papit/translator";

// foundations
import "@papit/button";
import "@papit/group";
import "@papit/icon";

// local
import sheet from "./style.css" with { type: "css" };
import { Carousel } from "component";

/**
 * `<pap-carousel-dots>` — one dot per position the gallery can scroll to (one per slide, unless
 * several fit in view without loop) plus the autoplay play/pause button.
 * Drives the carousel it sits in, or the one named by `aria-controls`.
 *
 * @element pap-carousel-dots
 *
 * @csspart dot  - Individual dot `<button>` per slide; the active one has `aria-disabled="true"`.
 * @csspart play - Play / pause toggle `pap-button`, shown when the carousel has `autoplay`.
 *
 * @cssprop --progress - Set on `part="play"` as a 0–1 value each frame while autoplaying.
 */
export class CarouselDots extends CustomElement {
    static sheet = sheet;

    // properties
    @translate t = useTranslator();
    @context({
        applyattribute: true, // stopcount="0" on the host hides the empty container
        query(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        }
    }) stopcount: number = 0; // one dot per position the gallery can scroll to
    @context({
        applyattribute: false,
        query(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        }
    }) slide: number = 0;
    @context({
        applyattribute: true,
        query(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        }
    }) autoplay: boolean = false;
    @context({
        applyattribute: true,
        query(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        }
    }) play: boolean = false;
    @context({
        applyattribute: false,
        rerender: false, // changes every frame, only the play button needs it
        query(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        },
        update(this: CarouselDots, value: number) {
            this.playButton?.style.setProperty("--progress", String(value));
        }
    }) progress: number = 0;

    @query("pap-button[part=\"play\"]") playButton!: HTMLElement;

    @query<Carousel>({
        outside: true,
        selector(this: CarouselDots) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "pap-carousel";
        },
    }) carousel: Carousel | null = null;

    // event handlers
    @bind
    private handleplay() {
        if (this.carousel && "play" in this.carousel) this.carousel.play = !this.carousel.play;
    }

    @bind
    private handledot(e: Event) {
        if (!(e.currentTarget instanceof HTMLElement)) return;

        const index = Number(e.currentTarget.getAttribute("data-slide"));
        if (this.carousel && index !== this.slide) this.carousel.slide = index; // aria-disabled, not real disabled
    }

    render() {
        if (this.stopcount === 0) return null;

        return html`
            <pap-group aria-label="${this.t("aria.dots")}">
                <pap-button
                    part="play"
                    aria-label="${this.t(this.play ? "aria.pause" : "aria.play")}"
                    color="secondary"
                    variant="clear"
                    size="icon"
                    @click="${this.handleplay}"
                >
                    <pap-icon aria-hidden="true" name="pause"></pap-icon>
                    <pap-icon aria-hidden="true" name="play"></pap-icon>
                </pap-button>

                ${Array.from({ length: this.stopcount }, (_, i) => html`
                    <button
                        key="${i}"
                        aria-disabled="${String(i === this.slide)}"
                        part="dot"
                        data-slide="${i}"
                        aria-label="${this.t("aria.slide", { index: i + 1, size: this.stopcount })}"
                        @click="${this.handledot}"
                    ></button>
                `)}
            </pap-group>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel-dots": CarouselDots;
    }
}
