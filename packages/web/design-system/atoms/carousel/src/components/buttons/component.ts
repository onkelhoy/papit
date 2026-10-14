// import statements 
// system 
import { bind, context, html, query } from "@papit/web-component";

// foundations 
import { Button } from "@papit/button";
import "@papit/icon";

// local 
import sheet from "./style.css" with { type: "css" };
import type { Carousel } from "component";
import { translate, useTranslator, type TransalatorFn } from "@papit/translator";

// the carousel's state the buttons read to disable themselves at the ends without loop
type Ends = { loop: boolean; slide: number; stopcount: number };

function controlsquery(this: HTMLElement) {
    const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
    return id ? `#${CSS.escape(id)}` : "";
}

// the label we set last per button, anything else in aria-label is the consumer's and stays
const ownlabels = new WeakMap<HTMLElement, string>();

// translated label, English until a loaded language has the key
function applylabel(element: HTMLElement, t: TransalatorFn, key: string, fallback: string) {
    const current = element.getAttribute("aria-label");
    if (current !== null && current !== ownlabels.get(element)) return;

    const text = t(key);
    const label = text === key ? fallback : text;
    ownlabels.set(element, label);
    element.setAttribute("aria-label", label);
}

// a slotted icon replaces the chevron; the fallback isn't rendered then, so it is never fetched
function hasicon(element: HTMLElement) {
    return element.querySelector(':scope > [slot="icon"]') !== null;
}

/**
 * `<pap-carousel-prev>` — the previous slide button.
 * Drives the carousel it sits in, or the one named by `aria-controls`.
 *
 * @element pap-carousel-prev
 *
 * @slot icon - Replaces the default chevron.
 */
export class CarouselPrev extends Button {
    static sheets = [Button.sheet];
    static sheet = sheet;

    @translate({
        update(this: CarouselPrev) {
            applylabel(this, this.t, "aria.prev", "previous slide");
        },
    }) t = useTranslator();

    @query<Carousel>({
        outside: true,
        selector(this: CarouselPrev) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "pap-carousel";
        },
    }) carousel: Carousel | null = null;

    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselPrev, value: boolean) { this.updatedisabled({ loop: value }); },
    }) loop = true;
    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselPrev, value: number) { this.updatedisabled({ slide: value }); },
    }) slide = 0;
    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselPrev, value: number) { this.updatedisabled({ stopcount: value }); },
    }) stopcount = 0;

    override variant: Button["variant"] = "outline";
    override size: Button["size"] = "icon";
    override color: Button["color"] = "secondary";

    override connectedCallback(): void {
        super.connectedCallback();
        // the translate hook only runs once a language is loaded, the button needs a name before that
        applylabel(this, this.t, "aria.prev", "previous slide");
        this.addEventListener("click", this.handleprev);
    }
    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("click", this.handleprev);
    }

    @bind
    private handleiconchange() {
        this.requestUpdate();
    }

    @bind
    private handleprev() {
        this.carousel?.prev();
    }

    // context hooks run before the field is assigned, so the incoming value is passed in
    private updatedisabled(next: Partial<Ends>) {
        const ends = { loop: this.loop, slide: this.slide, stopcount: this.stopcount, ...next };
        this.disabled = !ends.loop && ends.slide <= 0;
    }

    override render() {
        return html`
            <slot name="icon" @slotchange="${this.handleiconchange}">${hasicon(this) ? "" : html`<pap-icon class="prev" aria-hidden="true" name="chevron-down"></pap-icon>`}</slot>
        `
    }
}

/**
 * `<pap-carousel-next>` — the next slide button.
 * Drives the carousel it sits in, or the one named by `aria-controls`.
 *
 * @element pap-carousel-next
 *
 * @slot icon - Replaces the default chevron.
 */
export class CarouselNext extends Button {
    static sheets = [Button.sheet];
    static sheet = sheet;

    @translate({
        update(this: CarouselNext) {
            applylabel(this, this.t, "aria.next", "next slide");
        },
    }) t = useTranslator();

    @query<Carousel>({
        outside: true,
        selector(this: CarouselNext) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "pap-carousel";
        },
    }) carousel: Carousel | null = null;

    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselNext, value: boolean) { this.updatedisabled({ loop: value }); },
    }) loop = true;
    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselNext, value: number) { this.updatedisabled({ slide: value }); },
    }) slide = 0;
    @context({
        applyattribute: false,
        rerender: false,
        query: controlsquery,
        update(this: CarouselNext, value: number) { this.updatedisabled({ stopcount: value }); },
    }) stopcount = 0;

    override variant: Button["variant"] = "outline";
    override size: Button["size"] = "icon";
    override color: Button["color"] = "secondary";

    override connectedCallback(): void {
        super.connectedCallback();
        // the translate hook only runs once a language is loaded, the button needs a name before that
        applylabel(this, this.t, "aria.next", "next slide");
        this.addEventListener("click", this.handlenext);
    }
    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("click", this.handlenext);
    }

    @bind
    private handleiconchange() {
        this.requestUpdate();
    }

    @bind
    private handlenext() {
        this.carousel?.next();
    }

    // context hooks run before the field is assigned, so the incoming value is passed in
    private updatedisabled(next: Partial<Ends>) {
        const ends = { loop: this.loop, slide: this.slide, stopcount: this.stopcount, ...next };
        this.disabled = !ends.loop && ends.stopcount > 0 && ends.slide >= ends.stopcount - 1;
    }

    override render() {
        return html`
            <slot name="icon" @slotchange="${this.handleiconchange}">${hasicon(this) ? "" : html`<pap-icon class="next" aria-hidden="true" name="chevron-down"></pap-icon>`}</slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel-prev": CarouselPrev;
        "pap-carousel-next": CarouselNext;
    }
}
