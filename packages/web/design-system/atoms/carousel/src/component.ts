// import statements 
// system 
import { bind, CustomElement, debounce, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };

// tool 
import { translate, useTranslator } from "@papit/translator";

// foundations 
import "@papit/icon";
import "@papit/button";
import "@papit/group";

/**
 * `<pap-carousel>` — an accessible, infinite-scroll carousel.
 *
 * Implements the {@link https://www.w3.org/WAI/ARIA/apg/patterns/carousel/ | WAI-ARIA Carousel Pattern}.
 *
 * @element pap-carousel
 *
 * @slot - Default slot. Each child is promoted to `slot="slide"` and
 *   annotated with ARIA attributes automatically.
 *
 * @csspart carousel - Inner scroll container (`overflow-x: scroll`).
 * @csspart controls - Wrapper around all navigation controls.
 * @csspart prev    - Previous-slide `pap-button`.
 * @csspart next    - Next-slide `pap-button`.
 * @csspart dots    - `pap-group` containing dot indicator buttons.
 * @csspart dot     - Individual dot `<button>` per slide.
 * @csspart play    - Play / pause toggle `pap-button`.
 *
 * @cssprop --duration - Automatically set from the `duration` property (e.g. `5000ms`).
 *   Use it to drive a CSS progress animation on the play button.
 * @cssprop --progress - Set on `part="play"` as a 0–1 value each rAF tick.
 *
 * @fires change - Fired on `slide` changes.
 *
 * @attr {number}  slide    - Zero-based index of the active slide.
 * @attr {boolean} loop     - Whether the carousel wraps at either end (default `true`).
 * @attr {boolean} autoplay - Enables automatic slide rotation.
 * @attr {number}  duration - Milliseconds between automatic advances (default `5000`).
 * @attr {boolean} inline   - Renders controls under rather than overlaid.
 *
 * @example
 * ```html
 * <pap-carousel aria-label="Featured articles" autoplay duration="4000">
 *   <article>Article 1</article>
 *   <article>Article 2</article>
 * </pap-carousel>
 * ```
 */
export class Carousel extends CustomElement {
    static sheet = sheet;

    @property({
        type: Number,
        after(this: Carousel, value: number) {
            this.dotindex = value;

            this.resetProgress();

            this.dispatchEvent(new Event("change"));

            if (this._fromScroll)
            {
                this._fromScroll = false;
                return;
            }
            this.select(value);
        }
    }) slide = 0;
    @property({
        type: Number,
        rerender: true,
        attribute: false,
    }) dotindex = 0;
    @property({
        type: Boolean,
        after(this: Carousel) {
            if (this.loop === false)
            {
                this.firstclone?.remove();
                this.lastclone?.remove();
                this.firstclone = null;
                this.lastclone = null;
            }
            else 
            {
                this.setupClones();

            }
        }
    }) loop = true;


    // styling properties 
    @property({ attribute: "arrow-placement" }) arrowplacement!: "bottom" | "top" | "under" | "over" | "center-outside" | "center-inside";
    @property({ attribute: "dot-placement" }) dotplacement!: "bottom" | "top" | "under" | "over";
    @property({
        after(this: Carousel, _value, _old, initial) {
            switch (this.variant)
            {
                case "bottom":
                    if (!initial || !this.dotplacement) this.dotplacement = "under";
                    if (!initial || !this.arrowplacement) this.arrowplacement = "under";
                    break;
                case "top":
                    if (!initial || !this.dotplacement) this.dotplacement = "over";
                    if (!initial || !this.arrowplacement) this.arrowplacement = "over";
                    break;
                case "inside":
                    if (!initial || !this.dotplacement) this.dotplacement = "bottom";
                    if (!initial || !this.arrowplacement) this.arrowplacement = "center-inside";
                    break;
                case "outside":
                    if (!initial || !this.dotplacement) this.dotplacement = "under";
                    if (!initial || !this.arrowplacement) this.arrowplacement = "center-outside";
                    break;
                case "mix":
                    if (!initial || !this.dotplacement) this.dotplacement = "bottom";
                    if (!initial || !this.arrowplacement) this.arrowplacement = "center-outside";
                    break;
            }
        }
    }) variant: "inside" | "outside" | "mix" | "bottom" | "top" = "inside";
    @query("div[part=\"carousel\"]") carousel!: HTMLDivElement;
    @translate({
        update(this: Carousel) {
            for (const slide of this.slides) 
            {
                if (slide.getAttribute("aria-label") === "aria.slide")
                {
                    slide.setAttribute("aria-label", this.t("aria.slide", { index: Number(slide.getAttribute("data-slide")) + 1, size: this.slides.length }));
                }
            }

            if (this.firstclone) this.firstclone.setAttribute("aria-label", this.t("aria.firstclone"));
            if (this.lastclone) this.lastclone.setAttribute("aria-label", this.t("aria.lastclone"));
        }
    }) t = useTranslator();

    private slides: HTMLElement[] = [];
    private _fromScroll = false;
    private _programmatic = false;
    private _pendingloop: number | null = null;
    private firstclone: HTMLElement | null = null;
    private lastclone: HTMLElement | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        if (!this.hasAttribute("role")) this.setAttribute("role", "region");
        this.setAttribute("aria-roledescription", "carousel");
    }

    //#region clone
    @bind
    private handleslotchange(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        const elements = e.currentTarget.assignedElements();
        for (const elm of elements)
        {
            if (!(elm instanceof HTMLElement)) continue;

            elm.slot = "slide";
            if (!elm.hasAttribute("tabindex")) elm.setAttribute("tabindex", "0");
            elm.setAttribute("data-slide", String(this.slides.length));
            if (!elm.hasAttribute("role")) elm.setAttribute("role", "group");
            elm.setAttribute("aria-roledescription", "slide");
            if (!elm.hasAttribute("aria-label") && !elm.hasAttribute("aria-labelledby")) elm.setAttribute("aria-label", "aria.slide");

            this.slides.push(elm);
        }

        this.setupClones();
    }

    private cloneSlide(index: number, sign: number) {
        const clone = this.slides[index].cloneNode(true) as HTMLElement;

        clone.setAttribute("aria-hidden", "true");
        clone.setAttribute("role", "presentation");
        clone.setAttribute("id", "clone" + sign);
        clone.removeAttribute("tabindex");
        clone.classList.add("clone");
        clone.setAttribute("data-slide", String(index + sign));

        return clone;
    }

    private setupClones() {
        this.firstclone?.remove();
        this.lastclone?.remove();
        this.firstclone = null;
        this.lastclone = null;
        if (!this.slides) return;

        if (this.slides.length <= 1 || !this.loop) return;

        this.lastclone = this.cloneSlide(this.slides.length - 1, 1);
        this.lastclone.slot = "clone-prev";
        this.insertBefore(this.lastclone, this.firstElementChild);

        this.firstclone = this.cloneSlide(0, -1);
        this.firstclone.slot = "clone-next";
        this.firstclone.setAttribute("aria-label", this.t("aria.firstclone"));
        this.lastclone.setAttribute("aria-label", this.t("aria.lastclone"));
        this.appendChild(this.firstclone);

        // Force synchronous reflow — reading offsetWidth causes the browser
        // to resolve slot layout before we measure, so no rAF needed
        void this.lastclone.offsetWidth;

        const first = this.slides[0];
        if (!first) return;
        const offset = first.getBoundingClientRect().left - this.carousel.getBoundingClientRect().left;
        if (Math.round(offset) === 0) return;
        this._programmatic = true;
        this.carousel.scrollLeft += offset;

        this.requestUpdate();
    }
    //#endregion

    //#region autoplay
    @query("pap-button[part=\"play\"]") playButton!: HTMLButtonElement;
    @property({
        type: Boolean,
        after(this: Carousel) {
            if (this.carousel) 
            {
                this.carousel.setAttribute("aria-live", this.autoplay ? "off" : "polite");
            }
            this.setupAutoplay();
        }
    }) autoplay = false;
    @property({
        type: Boolean,
        removeAttribute: false,
        rerender: true,
        after(this: Carousel) {
            this.setupAutoplay();
        }
    }) play = true;
    @property({
        type: Number,
        after(this: Carousel) {
            this.style.setProperty("--duration", `${this.duration}ms`); // we could use this for animating some circle around play button 
            this.setupAutoplay();
        }
    }) duration = 5000;
    @property({
        type: Number,
        attribute: false,
        after(this: Carousel) {
            if (!this.playButton) return;
            this.playButton.style.setProperty("--progress", String(this.progress));
        }
    }) progress = 0;

    private timer: number | null = null;
    private timestamp: number | null = null;

    private setupAutoplay() {
        // stop existing loop
        if (this.timer !== null)
        {
            cancelAnimationFrame(this.timer);
            this.timer = null;
            this.progress = 0;
        }

        // don't run when disabled
        if (!this.autoplay || !this.play) return;

        const tick = (time: number) => {
            // loop teleport in flight — freeze until scrollend resolves it
            if (this._pendingloop !== null)
            {
                this.timestamp = null;
                this.timer = requestAnimationFrame(tick);
                return;
            }

            if (this.timestamp === null)
            {
                this.timestamp = time;
            }

            const elapsed = time - this.timestamp;
            this.progress = Math.min(elapsed / this.duration, 1);

            if (elapsed >= this.duration)
            {
                this.progress = 0;
                this.timestamp = time;
                this.next();
            }

            this.timer = requestAnimationFrame(tick);
        };

        this.timer = requestAnimationFrame(tick);
    }

    private stopAutoplay() {
        this.resetProgress();
        if (this.timer !== null)
        {
            cancelAnimationFrame(this.timer);
            this.timer = null;
        }

        this.timestamp = null;
    }

    private resetProgress() {
        this.progress = 0;
        this.timestamp = null;
    }

    @bind
    private handleplay() {
        this.play = !this.play;

        if (this.play)
        {
            this.setupAutoplay();
        }
        else
        {
            this.stopAutoplay();
        }
    }
    //#endregion

    //#region scroll
    private select(index: number, behavior: "smooth" | "instant" = "smooth") {
        if (!this.slides) return;
        const slide = this.slides[index];

        if (!slide) return;
        this.scrollToElement(slide, behavior);
    }

    private scrollToElement(element: HTMLElement, behavior: "smooth" | "instant" = "smooth") {
        const slideRect = element.getBoundingClientRect();
        const containerRect = this.carousel.getBoundingClientRect();
        const targetLeft = this.carousel.scrollLeft + slideRect.left - containerRect.left;

        if (Math.round(targetLeft) === Math.round(this.carousel.scrollLeft)) return;

        if (behavior === "instant")
        {
            this.carousel.scrollLeft = targetLeft;
        }
        else
        {
            this._programmatic = true;
            this.carousel.scrollTo({ left: targetLeft, behavior: "smooth" });
        }
    }

    @bind
    private handlescroll(e: Event) {
        this.scrollend();
        if (this._programmatic) return;

        const containerRect = this.carousel.getBoundingClientRect();
        const center = containerRect.left + containerRect.width / 2;

        let closest = this.slide;
        let minDist = Infinity;

        const compare = (slide: HTMLElement, realIndex?: number) => {
            const slideRect = slide.getBoundingClientRect();
            const slideCenter = slideRect.left + slideRect.width / 2;
            const dist = Math.abs(center - slideCenter);
            if (dist < minDist)
            {
                minDist = dist;
                closest = realIndex ?? Number(slide.dataset.slide);
                return true;
            }
            return false;
        }

        for (const slide of this.slides)
        {
            compare(slide);
        }

        this._pendingloop = null;
        if (this.lastclone && compare(this.lastclone, this.slides.length - 1))
        {
            this._pendingloop = this.slides.length - 1;
        }
        if (this.firstclone && compare(this.firstclone, 0))
        {
            this._pendingloop = 0;
        }

        if (closest !== this.slide) 
        {
            this._fromScroll = true;
            this.slide = closest;
        }
    }

    @debounce(90)
    private scrollend() {
        this._programmatic = false;
        // _fromScroll is self-clearing in after, no need to reset here

        if (this._pendingloop !== null)
        {
            const targetIndex = this._pendingloop;
            this._pendingloop = null;

            this._fromScroll = true;
            this.slide = targetIndex;            // sync dots first
            this._fromScroll = false;
            this.select(targetIndex, "instant"); // teleport (now synchronous)
        }
    }


    @bind
    public prev() {
        if (this._pendingloop !== null)
        {
            this.scrollToElement(this.slides[this.slides.length - 1], "instant");
            this.slide = this._pendingloop - 1;
            this._pendingloop = null;
            return;
        }

        if (this.slide === 0)
        {
            if (!this.loop) return;
            if (this.lastclone)
            {
                this._programmatic = true;
                this._pendingloop = this.slides.length - 1;
                this.scrollToElement(this.lastclone);
                this.dotindex = this._pendingloop;
                return;
            }
            else 
            {
                this._fromScroll = true; // we reuse the flag to avoid flickering 
                this.slide = this.slides.length; // will become last 
            }
        }

        this.slide--;
    }
    @bind
    public next() {
        if (this._pendingloop !== null)
        {
            this.scrollToElement(this.slides[0], "instant");
            this.slide = this._pendingloop + 1;
            this._pendingloop = null;
            return;
        }

        if (this.slide === this.slides.length - 1)
        {
            if (!this.loop) return;
            if (this.firstclone)
            {
                this._programmatic = true;
                this._pendingloop = 0;
                this.scrollToElement(this.firstclone);
                this.dotindex = 0;
                return;
            }
            else 
            {
                this._fromScroll = true; // we reuse the flag to avoid flickering 
                this.slide = -1; // will become 0 
            }
        }

        this.slide++;
    }
    //#endregion

    @bind
    private handledot(e: Event) {
        if (!(e.currentTarget instanceof HTMLButtonElement)) return;
        const idx = Number(e.currentTarget.getAttribute("data-slide"));
        if (idx === this.slide) return; // aria-disabled, not real disabled
        this.slide = idx;
    }

    render() {
        return html`
            <slot @slotchange="${this.handleslotchange}"></slot>

            <div 
                aria-atomic="false" 
                part="carousel" 
                id="carousel"
                aria-live="${this.autoplay ? "off" : "polite"}" 
                @scroll="${this.handlescroll}"
            >
                <slot name="clone-prev"></slot>
                <slot name="slide"></slot>
                <slot name="clone-next"></slot>
            </div>

            <pap-button 
                variant="outline" 
                color="secondary" 
                aria-label="${this.t("aria.prev")}"
                part="prev"
                size="icon"
                aria-controls="carousel"
                @click="${this.prev}" 
            >
                <pap-icon aria-hidden="true" name="chevron-down"></pap-icon>
            </pap-button>

            <pap-group part="dots" aria-label="${this.t("aria.dots")}">
                <pap-button  
                    part="play" 
                    aria-label="${this.t(this.play ? "aria.pause" : "aria.play")}" 
                    color="secondary" 
                    variant="clear" 
                    size="icon"
                    aria-controls="carousel"
                    @click="${this.handleplay}" 
                >
                    <pap-icon aria-hidden="true" name="pause"></pap-icon>
                    <pap-icon aria-hidden="true" name="play"></pap-icon>
                </pap-button>

                ${this.slides.map((s, i) => html`
                    <button 
                        key="${i}" 
                        aria-disabled="${String(i === this.dotindex)}"  
                        part="dot"
                        aria-controls="carousel"
                        data-slide="${i}"
                        aria-label="${s.getAttribute("aria-label") ?? String(i + 1)}"
                        @click="${this.handledot}" 
                    ></button>
                `)}
            </pap-group>

            <pap-button 
                variant="outline" 
                color="secondary" 
                aria-label="${this.t("aria.next")}"
                part="next"
                aria-controls="carousel"
                size="icon"
                @click="${this.next}" 
            >
                <pap-icon aria-hidden="true" name="chevron-down"></pap-icon>
            </pap-button>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel": Carousel;
    }
}