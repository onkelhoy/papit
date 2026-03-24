// import statements 
// system 
import { CustomElement, html, property, query } from "@papit/web-component";

// local 
import sheet from "./style.css" assert { type: "css" };
/**
 * A resizable split-pane component that allows users to adjust the relative
 * size of two panels by dragging a separator or using keyboard controls.
 * Follows the WAI-ARIA Window Splitter pattern — the separator is the
 * focusable widget, and its value represents the size of the primary pane
 * as a percentage between `min` and `max`.
 *
 * @element pap-splitter
 *
 * @slot primary - The primary pane. Its size is represented by `aria-valuenow`.
 * @slot secondary - The secondary pane. Takes up the remaining space.
 *
 * @attr {"vertical" | "horizontal"} split - Orientation of the splitter (default: "vertical")
 * @attr {number} min - Minimum value of the primary pane in percent (default: 0)
 * @attr {number} max - Maximum value of the primary pane in percent (default: 100)
 * @attr {number} step - Keyboard step size in percent (default: 5)
 * @attr {string} label - Accessible label for the separator, should describe the primary pane
 * @attr {boolean} data-drag - Reflects whether the separator is currently being dragged
 *
 * @example Vertical split (side by side):
 * ```html
 * <pap-splitter label="Sidebar" style="height: 400px;">
 *   <nav slot="primary">Sidebar content</nav>
 *   <main slot="secondary">Main content</main>
 * </pap-splitter>
 * ```
 *
 * @example Horizontal split (stacked):
 * ```html
 * <pap-splitter split="horizontal" label="Editor" style="height: 600px;">
 *   <div slot="primary">Editor</div>
 *   <div slot="secondary">Terminal</div>
 * </pap-splitter>
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ WAI-ARIA Window Splitter Pattern}
 */
export class Splitter extends CustomElement {
    static sheet = sheet;

    @property label: string = "";
    @property split: "horizontal" | "vertical" = "vertical";
    @property({ attribute: "data-drag" }) dragging = false;
    @property min: number = 0;
    @property max: number = 100;
    @property step: number = 5; // keyboard step size

    @query('div[role="separator"]') separatorElement!: HTMLDivElement;

    connectedCallback(): void {
        super.connectedCallback();
        this.setvalue(this.value);
    }

    private storedValue: number | null = null;
    private value: number = 50;

    private handlekeydown = (e: KeyboardEvent) => {
        if (/Escape/i.test(e.key) && this.storedValue != null)
        {
            this.style.setProperty("--value", this.storedValue + "%");
            this.value = this.storedValue;
            this.storedValue = null;
            this.dragging = false;
            return;
        }

        const isVertical = this.split === "vertical";

        if ((isVertical && e.key === "ArrowLeft") || (!isVertical && e.key === "ArrowUp")) 
        {
            e.preventDefault();
            this.setvalue(this.value - this.step);
        }
        else if ((isVertical && e.key === "ArrowRight") || (!isVertical && e.key === "ArrowDown")) 
        {
            e.preventDefault();
            this.setvalue(this.value + this.step);
        }
        else if (e.key === "Home") 
        {
            e.preventDefault();
            this.setvalue(this.min);
        }
        else if (e.key === "End") 
        {
            e.preventDefault();
            this.setvalue(this.max);
        }
        else if (e.key === "Enter") 
        {
            e.preventDefault();
            if (this.value === this.min) 
            {
                this.setvalue(this.storedValue ?? 50);
                this.storedValue = null;
            }
            else 
            {
                this.storedValue = this.value;
                this.setvalue(this.min);
            }
        }
    }

    private handlepointerdown = (e: PointerEvent) => {
        const bar = e.currentTarget as HTMLElement;
        bar.setPointerCapture(e.pointerId);
        this.storedValue = this.value;
        this.dragging = true;
    }

    private handlepointermove = (e: PointerEvent) => {
        if (!this.dragging) return;
        this.drag(e);
    }

    private handlepointerup = (e: PointerEvent) => {
        if (!this.dragging) return;
        this.drag(e);
        this.dragging = false;
        this.storedValue = null;
    }

    private handlepointercancel = () => {
        if (this.storedValue !== null)
        {
            this.setvalue(this.storedValue);
        }
        this.storedValue = null;
        this.dragging = false;
    }

    private setvalue(v: number) {
        this.value = Math.min(this.max, Math.max(this.min, v));
        this.style.setProperty("--value", this.value + "%");
        this.separatorElement.setAttribute("aria-valuenow", String(this.value));
    }
    private getValue(value: number, min: number, max: number) {
        const pct = ((value - min) / (max - min)) * 100;
        if (pct < 0) return 0;
        if (pct > 100) return 100;
        return Math.round(pct * 100) / 100;
    }
    private drag(e: MouseEvent) {
        const box = this.getBoundingClientRect();

        if (this.split === "vertical")
        {
            this.setvalue(this.getValue(e.clientX, box.left, box.right));
        }
        else 
        {
            this.setvalue(this.getValue(e.clientY, box.top, box.bottom));
        }
    }

    render() {
        return html`
            <div class="panel" part="primary" id="primary-pane"><slot name="primary"></slot></div>
            <div 
                tabindex="0"
                part="separator"
                role="separator"
                aria-label="${this.label}"
                aria-controls="primary-pane"
                aria-orientation="${this.split}"
                aria-valuemin="${this.min}"
                aria-valuemax="${this.max}"
                @keydown="${this.handlekeydown}"
                @pointerdown="${this.handlepointerdown}"
                @pointermove="${this.handlepointermove}"
                @pointerup="${this.handlepointerup}"
                @pointercancel="${this.handlepointercancel}"
            >
                <span part="thumb"></span>
            </div>
            <div class="panel" part="secondary"><slot name="secondary"></slot></div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-splitter": Splitter;
    }
}