// import statements 
// system 
import { bind, html, query } from "@papit/web-component";

// foundations 
import { Button } from "@papit/button";
import "@papit/icon";

// local 
import sheet from "./style.css" with { type: "css" };
import type { Carousel } from "component";
import { translate, useTranslator } from "@papit/translator";

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
        update(this: CarouselNext) {
            this.setAttribute("aria-label", this.t("aria.prev"));
        },
    }) t = useTranslator();

    @query<Carousel>({
        outside: true,
        selector(this: CarouselPrev) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "pap-carousel";
        },
    }) carousel: Carousel | null = null;

    override variant: Button["variant"] = "outline";
    override size: Button["size"] = "icon";
    override color: Button["color"] = "secondary";

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("click", this.handleprev);
    }
    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("click", this.handleprev);
    }

    @bind
    private handleprev() {
        this.carousel?.prev();
    }

    override render() {
        return html`
            <slot name="icon"><pap-icon class="prev" aria-hidden="true" name="chevron-down"></pap-icon></slot>
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
            this.setAttribute("aria-label", this.t("aria.next"));
        },
    }) t = useTranslator();

    @query<Carousel>({
        outside: true,
        selector(this: CarouselNext) {
            const id = this.getAttribute("aria-controls"); // aria-controls holds an id, not a selector
            return id ? `#${CSS.escape(id)}` : "pap-carousel";
        },
    }) carousel: Carousel | null = null;

    override variant: Button["variant"] = "outline";
    override size: Button["size"] = "icon";
    override color: Button["color"] = "secondary";

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("click", this.handlenext);
    }
    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener("click", this.handlenext);
    }

    @bind
    private handlenext() {
        this.carousel?.next();
    }

    override render() {
        return html`
            <slot name="icon"><pap-icon class="next" aria-hidden="true" name="chevron-down"></pap-icon></slot>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-carousel-prev": CarouselPrev;
        "pap-carousel-next": CarouselNext;
    }
}
