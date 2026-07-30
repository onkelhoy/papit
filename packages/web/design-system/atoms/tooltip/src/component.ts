// import statements 
// system 
import { bind, debounce, html, property } from "@papit/web-component";
import { Popover } from "@papit/popover";
// local 
import sheet from "./style.css" with { type: "css" };

export class Tooltip extends Popover {
    static sheets = [Popover.sheet, sheet];

    private timer: NodeJS.Timeout | null = null;
    private static CURRENT: Tooltip | null = null;

    @property variant: "primary" | "secondary" = "primary";
    @property({ type: Number, attribute: "delay" }) delay = 1000;
    @property({ type: Boolean }) instant = false;
    @property({ type: Boolean, removeAttribute: false }) marker = false;

    // @property({ reflect: false, rerender: true }) private state: "hidden" | "closing" | "open" = "hidden";
    @property({
        type: Boolean,
        after(this: Tooltip, value: boolean) {
            if (value) this.hide();
        }
    }) disabled = false;

    connectedCallback(): void {
        super.connectedCallback();

        // Remove click handlers since tooltips use hover/focus
        this.refs.forEach(ref => {
            ref.removeEventListener("click", this.handlerefclick);
            ref.setAttribute("popovertargetaction", "hover");
            ref.addEventListener("focus", this.handlereffocus);
            ref.addEventListener("focusout", this.handlereffocusout);
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this.refs.forEach(ref => {
            ref.removeEventListener("focus", this.handlereffocus);
            ref.removeEventListener("focusout", this.handlereffocusout);
        });

        if (this.timer) clearTimeout(this.timer);

        if (Tooltip.CURRENT === this)
        {
            Tooltip.CURRENT = null;
        }
    }

    // Focus handlers
    @bind
    private handlereffocus(e: FocusEvent) {
        if (this.disabled) return;
        const target = e.currentTarget as HTMLElement;
        this.show(target);
    }

    @bind
    private handlereffocusout(e: FocusEvent) {
        // if (this.enterMode !== "focus") return;

        // Check where focus is going
        requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            const isOnTrigger = this.refs.some(ref =>
                ref === activeElement || ref.contains(activeElement)
            );
            const isInsideTooltip = this.contains(activeElement);

            if (!isOnTrigger && !isInsideTooltip)
            {
                this.hide();
            }
        });
    }

    override show(element?: HTMLElement) {
        if (this.timer)
        {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.disabled) return;

        // Close any other open tooltip before setting ourselves as current
        const previous = Tooltip.CURRENT;
        if (previous && previous !== this)
        {
            previous.hide();
        }

        const doShow = () => {
            super.show(element);
            this.timer = null;
            Tooltip.CURRENT = this;
        };

        // Show instantly if there was another tooltip or instant mode
        if (this.instant || previous)
        {
            doShow();
        } else
        {
            this.timer = setTimeout(doShow, this.delay);
        }

    }

    override hide() {
        if (this.timer)
        {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (!this.open) return;

        super.hide();

        // Only clear current if we're still the current one
        if (Tooltip.CURRENT === this)
        {
            Tooltip.CURRENT = null;
        }
    }

    // TODO replace container with before ? 
    render() {
        return html`
            <div part="container">
                <slot></slot>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-tooltip": Tooltip;
    }
}