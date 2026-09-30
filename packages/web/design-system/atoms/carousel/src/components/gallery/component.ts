// import statements 
// system 
import { bind, context, CustomElement, debounce, findTarget, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" with { type: "css" };
import { translate, useTranslator } from "@papit/translator";
import type { Carousel } from "component";

/**
 * `<pap-carousel-gallery>`, the scrolling track of a carousel: its slides, snapping and the loop.
 * It only shows `slide`; navigation and autoplay live on `<pap-carousel>`, which it takes `slide`,
 * `loop` and `autoplay` from (through context) and reports user scrolling and its slide count back to. Inside a carousel,
 * set those on the carousel.
 * Place it inside the carousel, or anywhere with `aria-controls` set to the carousel's id.
 *
 * @slot - The slides. Each child becomes a slide (`role="group"`, `aria-roledescription="slide"`);
 *   `pap-carousel-*` controls placed here are left alone.
 *
 * @csspart carousel - The scroll container; set `padding-inline` / `scroll-padding-inline` here for a gutter.
 *
 * @cssprop --size - Width of one slide (default `100%`), e.g. `30%` for about three per view.
 *
 * @fires change - Fired on `slide` changes (not for the initial value).
 */
export class CarouselGallery extends CustomElement {
    static sheet = sheet;

    // properties 
    @query("div[part=\"carousel\"]") carousel!: HTMLDivElement;
    // from a surrounding pap-carousel: rotating slides shouldn't be announced
    @context({
        applyattribute: false,
        query(this: CarouselGallery) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        },
    }) autoplay: boolean = false;
    @property({
        after(this: CarouselGallery) {
            this.measure();
        }
    }) align: "center" | "start" = "center";
    @context({
        applyattribute: false,
        rerender: false,
        query(this: CarouselGallery) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        },
    })
    @property({
        type: Boolean,
        after(this: CarouselGallery) {
            if (this.loop === false)
            {
                this.removeClones();
                // the copies in front are gone, so the track shifted under the current slide
                if (this.carousel) this.select(this.slide, "instant");
            }
            else 
            {
                this.setupClones();

            }
            this.measure();
        }
    }) loop = true;
    // set by the carousel (through context) or directly; any integer, wrapped (loop) or clamped into range
    @context({
        applyattribute: false,
        rerender: false,
        query(this: CarouselGallery) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "";
        },
    })
    @property({
        type: Number,
        context: true,
        after(this: CarouselGallery, value: number, old: number | undefined, initial: boolean) {
            if (this._quiet) return; // our own correction below, already handled

            if (this._fromScroll)
            {
                this._fromScroll = false;
                this.report(old, initial);
                return;
            }

            const { index, wrap } = this.resolve(value, old ?? 0);
            if (index !== value)
            {
                this._quiet = true;
                this.slide = index;
                this._quiet = false;
            }

            this.report(old, initial);
            this.move(index, wrap);
        }
    }) slide = 0;

    @property({
        type: Number,
        after(this: CarouselGallery, value: number, _old, initial) {
            this.setupClones();
        }
    }) clonecount = 3;

    @translate({
        update(this: CarouselGallery) {
            this.labelSlides();

            this._clonesafter.forEach(clone => clone.setAttribute("aria-label", this.t("aria.firstclone")));
            this._clonesbefore.forEach(clone => clone.setAttribute("aria-label", this.t("aria.lastclone")));
        }
    }) t = useTranslator();


    // read by pap-carousel-dots through context
    @property({
        type: Array,
        attribute: false,
        context: true,
        // compare by identity, a re-rendered list with the same markup is still a new list
        hasChanged: (value: HTMLElement[], old?: HTMLElement[]) => !old || value.length !== old.length || value.some((slide, index) => slide !== old[index]),
    }) slides: HTMLElement[] = [];
    // positions the track can actually scroll to: one per slide, except without loop and with several
    // per view, where the last slides can't reach the snap point and share the end of the track
    @property({
        type: Number,
        attribute: false,
        context: true,
    }) stopcount = 0;

    private generatedLabels = new WeakSet<HTMLElement>(); // slides without an author label, labelled "x of n" by us
    // how many slides are copied onto each end for the loop
    private _clonesbefore: HTMLElement[] = []; // copies of the last slides, in front of the first
    private _clonesafter: HTMLElement[] = []; // copies of the first slides, after the last
    private _pendingloop: number | null = null;
    private _fromScroll = false;
    private _programmatic = false;
    private _quiet = false;
    private _target: number | null = null; // where our own smooth scroll is heading
    private _resize: ResizeObserver | null = null;

    connectedCallback(): void {
        super.connectedCallback();
        if (this.carousel) this.measure(); // reconnected: watch the size again
        // with a pap-carousel, that is the carousel region
        if (this.ownerElement()) return;
        if (!this.hasAttribute("role")) this.setAttribute("role", "region");
        this.setAttribute("aria-roledescription", "carousel");
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this._resize?.disconnect();
        this._resize = null;
    }

    //#region carousel
    private ownerElement() {
        // the carousel named by aria-controls, else the one this gallery sits in
        const id = this.getAttribute("aria-controls");
        return findTarget(this, id ? `#${CSS.escape(id)}` : undefined, target => target.tagName === "PAP-CAROUSEL" ? target : null);
    }

    // only once upgraded, setting properties on a plain element would shadow them
    private owner(): Carousel | null {
        const owner = this.ownerElement();
        return owner && "next" in owner ? owner as Carousel : null;
    }

    // tell the carousel (and so the controls) where we are, and fire change
    private report(old: number | undefined, initial: boolean) {
        if (!initial && this.slide !== old) this.dispatchEvent(new Event("change"));

        const owner = this.owner();
        if (owner && owner.slide !== this.slide) owner.slide = this.slide;
    }

    // where a requested slide lands, and whether it crossed the end of a loop (1 forward, -1 back)
    private resolve(value: number, old: number) {
        const size = this.slides.length;
        if (size === 0) return { index: value, wrap: 0 };

        // without loop the last position is the end of the track
        if (!this.loop) return { index: Math.max(0, Math.min(value, (this.stopcount || size) - 1)), wrap: 0 };

        return { index: ((value % size) + size) % size, wrap: value >= size ? 1 : value < 0 ? -1 : 0 };
    }

    private move(index: number, wrap: number) {
        if (!this.carousel || !this.slides[index]) return;

        // a loop glide still running: land it first, so we move on from the real slide
        if (this._pendingloop !== null)
        {
            this.select(this._pendingloop, "instant");
            this._pendingloop = null;
        }

        // crossing the end: glide onto the copy of the slide, settle() then jumps to the real one
        const clone = wrap > 0
            ? this._clonesafter[index]
            : wrap < 0 ? this._clonesbefore[index - (this.slides.length - this._clonesbefore.length)] : undefined;

        if (clone)
        {
            this._pendingloop = index;
            this.scrollToElement(clone);
            return;
        }

        this.select(index);
    }
    // count the positions the track can scroll to, and tell the carousel
    private measure() {
        if (!this.carousel) return;

        if (!this._resize)
        {
            // a narrower track fits fewer slides, e.g. --size changing at a breakpoint
            this._resize = new ResizeObserver(() => this.measure());
            this._resize.observe(this.carousel);
        }

        const size = this.slides.length;
        let stops = size;
        if (!this.loop && size > 0)
        {
            // the first slide that can't scroll any further is the last position
            const end = this.maxScroll - 1;
            const last = this.slides.findIndex(slide => this.scrollTarget(slide) >= end);
            if (last >= 0) stops = last + 1;
        }

        this.stopcount = stops;
        const owner = this.owner();
        if (owner) owner.stopcount = stops;

        if (stops > 0 && this.slide > stops - 1) this.slide = stops - 1;
    }
    //#endregion

    // event handlers
    @bind
    private handleslotchange(e: Event) {
        if (!(e.currentTarget instanceof HTMLSlotElement)) return;

        const elements = e.currentTarget.name ? [] : e.currentTarget.assignedElements();
        for (const elm of elements)
        {
            if (!(elm instanceof HTMLElement)) continue;
            // controls placed inside stay in the default slot, they are not slides
            if (elm.tagName.startsWith("PAP-CAROUSEL-")) continue;

            elm.slot = "slide";
            if (!elm.hasAttribute("tabindex")) elm.setAttribute("tabindex", "0");
            if (!elm.hasAttribute("role")) elm.setAttribute("role", "group");
            elm.setAttribute("aria-roledescription", "slide");
            if (!elm.hasAttribute("aria-label") && !elm.hasAttribute("aria-labelledby")) this.generatedLabels.add(elm);
        }

        this.slides = Array.from(this.children).filter((elm): elm is HTMLElement => elm instanceof HTMLElement && elm.slot === "slide");
        this.slides.forEach((slide, index) => slide.setAttribute("data-slide", String(index)));
        this.labelSlides();

        this.setupClones();
        this.requestUpdate();

        const owner = this.owner();
        if (owner) owner.slidecount = this.slides.length;

        if (this.slides.length > 0 && this.slide > this.slides.length - 1) this.slide = this.slides.length - 1;
        else if (this.slide > 0) this.select(this.slide, "instant"); // slide was set before the slides arrived

        this.measure();
    }

    @bind
    private handlescroll(e: Event) {
        if (!("onscrollend" in window)) this.scrollend();
        if (this._programmatic) return;

        // the active slide is the one whose snap point (centre or start edge) is nearest the container's
        const start = this.align === "start";
        const containerRect = this.carousel.getBoundingClientRect();
        const anchor = start
            ? containerRect.left + this.scrollPaddingStart()
            : containerRect.left + containerRect.width / 2;

        let closest = this.slide;
        let minDist = Infinity;

        const compare = (slide: HTMLElement, realIndex?: number) => {
            const slideRect = slide.getBoundingClientRect();
            const point = start ? slideRect.left : slideRect.left + slideRect.width / 2;
            const dist = Math.abs(anchor - point);
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

        // clones carry their real slide index in data-slide
        this._pendingloop = null;
        for (const clone of [...this._clonesbefore, ...this._clonesafter])
        {
            if (compare(clone)) this._pendingloop = closest;
        }

        // without loop, the last position is the end of the track: once there, it is the active one
        if (!this.loop && this.stopcount > 0)
        {
            const atend = Math.ceil(this.carousel.scrollLeft) >= this.maxScroll - 1;
            closest = atend ? this.stopcount - 1 : Math.min(closest, this.stopcount - 1);
        }

        if (closest !== this.slide) 
        {
            this._fromScroll = true;
            this.slide = closest;
        }
    }

    // fallback for engines without the scrollend event
    @debounce(90)
    private scrollend() {
        this.settle();
    }

    // smooth scroll can outlast the 90 ms debounce (Firefox), so hold the flag until scrollend
    @bind
    private handlescrollend() {
        this.settle();
    }

    private settle() {
        // WebKit can fire scrollend part-way through a smooth scrollTo and then carry on: if we are
        // short of our target and still moving, the real scrollend is still to come
        if (this._programmatic && this._target !== null && Math.abs(this.carousel.scrollLeft - this._target) > 1)
        {
            const position = this.carousel.scrollLeft;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                // stopped short (e.g. the user took over): treat it as the end after all
                if (!this._programmatic || this.carousel.scrollLeft !== position) return;
                this._target = null;
                this.settle();
            }));
            return;
        }

        this._target = null;
        this._programmatic = false;
        // _fromScroll is self-clearing in after, no need to reset here

        if (this._pendingloop !== null)
        {
            const targetIndex = this._pendingloop;
            this._pendingloop = null;

            if (this.slide !== targetIndex)
            {
                this._fromScroll = true;
                this.slide = targetIndex;            // sync dots first
            }
            this.select(targetIndex, "instant"); // teleport (now synchronous)
        }
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
                @scrollend="${this.handlescrollend}"
            >
                <slot name="clone-prev"></slot>
                <slot name="slide" @slotchange="${this.handleslotchange}"></slot>
                <slot name="clone-next"></slot>
            </div>
        `
    }

    private select(index: number, behavior: "smooth" | "instant" = "smooth") {
        if (!this.slides) return;
        const slide = this.slides[index];

        if (!slide) return;
        this.scrollToElement(slide, behavior);
    }
    private scrollPaddingStart() {
        if (this.align !== "start") return 0;
        const value = parseFloat(getComputedStyle(this.carousel).scrollPaddingInlineStart);
        return isNaN(value) ? 0 : value;
    }

    private scrollTarget(element: HTMLElement) {
        const slideRect = element.getBoundingClientRect();
        const containerRect = this.carousel.getBoundingClientRect();
        return this.carousel.scrollLeft + slideRect.left - containerRect.left - this.scrollPaddingStart();
    }

    private get maxScroll() {
        return this.carousel.scrollWidth - this.carousel.clientWidth;
    }

    private scrollToElement(element: HTMLElement, behavior: "smooth" | "instant" = "smooth") {
        // clamp, a target past the end never scrolls and would leave _programmatic stuck
        const targetLeft = Math.max(0, Math.min(this.scrollTarget(element), this.maxScroll));

        if (Math.round(targetLeft) === Math.round(this.carousel.scrollLeft)) return;

        if (behavior === "instant")
        {
            this.carousel.scrollLeft = targetLeft;
        }
        else
        {
            this._programmatic = true;
            this._target = targetLeft;
            this.carousel.scrollTo({ left: targetLeft, behavior: "smooth" });
        }
    }
    private labelSlides() {
        for (const slide of this.slides)
        {
            if (!this.generatedLabels.has(slide)) continue;
            slide.setAttribute("aria-label", this.t("aria.slide", { index: Number(slide.getAttribute("data-slide")) + 1, size: this.slides.length }));
        }
    }

    private cloneSlide(index: number, slot: "clone-prev" | "clone-next") {
        const clone = this.slides[index].cloneNode(true) as HTMLElement;

        clone.slot = slot;
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true; // links inside a copy must not be focusable
        clone.setAttribute("role", "presentation");
        clone.removeAttribute("id"); // copies must not repeat the slide's id
        clone.removeAttribute("tabindex");
        clone.classList.add("clone");
        clone.setAttribute("data-slide", String(index));
        clone.setAttribute("aria-label", this.t(slot === "clone-next" ? "aria.firstclone" : "aria.lastclone"));

        return clone;
    }

    private removeClones() {
        for (const clone of [...this._clonesbefore, ...this._clonesafter]) clone.remove();
        this._clonesbefore = [];
        this._clonesafter = [];
    }

    private setupClones() {
        this.removeClones();
        if (!this.slides) return;

        if (this.slides.length <= 1 || !this.loop) return;

        const size = this.slides.length;
        const count = Math.min(this.clonecount, size);
        this._clonesbefore = Array.from({ length: count }, (_, i) => this.cloneSlide(size - count + i, "clone-prev"));
        this._clonesafter = Array.from({ length: count }, (_, i) => this.cloneSlide(i, "clone-next"));
        this.prepend(...this._clonesbefore);
        this.append(...this._clonesafter);

        // Force synchronous reflow — reading offsetWidth causes the browser
        // to resolve slot layout before we measure, so no rAF needed
        void this._clonesbefore[0].offsetWidth;

        const first = this.slides[0];
        if (!first) return;
        const offset = this.scrollTarget(first) - this.carousel.scrollLeft;
        if (Math.round(offset) === 0) return;
        this._programmatic = true;
        this.carousel.scrollLeft += offset;

        this.requestUpdate();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel-gallery": CarouselGallery;
    }
}