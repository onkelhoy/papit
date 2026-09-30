// import statements
// system
import { bind, CustomElement, html, property } from "@papit/web-component";

// local
import sheet from "./style.css" with { type: "css" };

/**
 * `<pap-carousel>` — an accessible carousel: a plain wrapper that holds the state (`slide`,
 * `slidecount`, autoplay) and the navigation (`next()`, `prev()`).
 *
 * Implements the {@link https://www.w3.org/WAI/ARIA/apg/patterns/carousel/ | WAI-ARIA Carousel Pattern}.
 * A `pap-carousel-gallery` shows the slides and the controls (`pap-carousel-prev`, `pap-carousel-next`,
 * `pap-carousel-dots`, or your own calling the API) drive it. They can live anywhere inside it, so
 * the layout is yours, or outside with `aria-controls` set to the carousel's id.
 * Autoplay pauses while the pointer is over the carousel or focus is inside it.
 *
 * @element pap-carousel
 *
 * @slot - The `pap-carousel-gallery` and the controls, in any layout.
 *
 * @cssprop --duration - Automatically set from the `duration` property (e.g. `5000ms`).
 *
 * @fires change - Fired when the gallery's active slide changes (not for the initial value).
 *
 * @attr {number}  slide    - Zero-based index of the active slide; the gallery wraps or clamps it.
 * @attr {boolean} loop     - Whether the gallery wraps at either end (default `true`).
 * @attr {boolean} autoplay - Enables automatic slide rotation.
 * @attr {boolean} play     - Pauses (`false`) or resumes autoplay (default `true`).
 * @attr {number}  duration - Milliseconds between automatic advances (default `5000`).
 *
 * @example
 * ```html
 * <pap-carousel aria-label="Featured articles" autoplay duration="4000">
 *   <pap-carousel-gallery>
 *     <article>Article 1</article>
 *     <article>Article 2</article>
 *   </pap-carousel-gallery>
 *   <pap-carousel-prev></pap-carousel-prev>
 *   <pap-carousel-dots></pap-carousel-dots>
 *   <pap-carousel-next></pap-carousel-next>
 * </pap-carousel>
 * ```
 */
export class Carousel extends CustomElement {
    static sheet = sheet;

    @property({
        type: Boolean,
        context: true,
        after(this: Carousel) {
            this.setupAutoplay();
        }
    }) autoplay = false;
    @property({
        type: Boolean,
        context: true,
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
    // 0–1 through the current slide's duration, read by pap-carousel-dots for the play button
    @property({
        type: Number,
        attribute: false,
        context: true,
    }) progress = 0;

    // read by the gallery through context
    @property({
        type: Boolean,
        context: true,
    }) loop = true;
    // the gallery reads it through context and reports user scrolling back
    @property({
        type: Number,
        context: true,
        after(this: Carousel, _value: number, _old, initial) {
            this.resetProgress();
            if (!initial) this.dispatchEvent(new Event("change"));
        }
    }) slide = 0;
    // set by the gallery whenever its slides change, read by the controls
    @property({
        type: Number,
        attribute: false,
        context: true,
    }) slidecount = 0;
    // set by the gallery: positions it can scroll to (fewer than slides without loop and with
    // several per view), read by pap-carousel-dots
    @property({
        type: Number,
        attribute: false,
        context: true,
    }) stopcount = 0;

    private timer: number | null = null;
    private timestamp: number | null = null;
    private lasttick: number | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        if (!this.hasAttribute("role")) this.setAttribute("role", "region");
        this.setAttribute("aria-roledescription", "carousel");
        this.setupAutoplay();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopAutoplay();
    }

    /** Goes to the previous slide; the gallery wraps (loop) or stops at the start. */
    @bind
    public prev() {
        this.slide--;
    }

    /** Goes to the next slide; the gallery wraps (loop) or stops at the end. */
    @bind
    public next() {
        this.slide++;
    }

    //#region autoplay
    private setupAutoplay() {
        // stop existing loop
        if (this.timer !== null)
        {
            cancelAnimationFrame(this.timer);
            this.timer = null;
            this.progress = 0;
        }

        // don't run when disabled
        if (!this.autoplay || !this.play || !this.isConnected) return;

        const tick = (time: number) => {
            // WCAG 2.2.2: hold while the pointer is over the carousel or focus is in it,
            // shifting the start so the progress continues where it was
            if (this.matches(":hover, :focus-within"))
            {
                if (this.timestamp !== null && this.lasttick !== null) this.timestamp += time - this.lasttick;
                this.lasttick = time;
                this.timer = requestAnimationFrame(tick);
                return;
            }
            this.lasttick = time;

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
    }

    private resetProgress() {
        this.progress = 0;
        this.timestamp = null;
    }
    //#endregion

    render() {
        return html`<slot></slot>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel": Carousel;
    }
}
