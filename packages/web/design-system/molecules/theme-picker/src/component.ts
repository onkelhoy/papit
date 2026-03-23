// import statements 
// system 
import { CustomElement, html, property, query } from "@papit/web-component";

// foundstions 
import "@papit/icon";

// atoms 
import "@papit/menu";
import "@papit/tooltip";


// local 
import sheet from "./style.css" assert { type: "css" };
import { Tooltip } from "@papit/tooltip";

export class ThemePicker extends CustomElement {
    static sheet = sheet;

    private targetElement: HTMLElement | null = null;
    private targetElementObserver: MutationObserver | null = null;
    private internal = false;

    @query("pap-tooltip") private tooltipElement!: Tooltip;
    @query("button") private buttonElement!: HTMLButtonElement;

    // properties 
    @property({
        after(this: ThemePicker) {
            const element = document.querySelector<HTMLElement>(this.target);

            if (this.targetElementObserver)
            {
                this.targetElementObserver.disconnect();
            }

            if (element)
            {
                this.targetElement = element;
                this.targetElementObserver = new MutationObserver((records) => {
                    if (this.internal) 
                    {
                        return;
                    }
                    // we check all records ? 
                    // or we simply check the element ? 
                    const themeAttr = element.getAttribute("data-theme");
                    const isLight = element.classList.contains("theme-light") || themeAttr === "light";
                    const isDark = element.classList.contains("theme-dark") || themeAttr === "dark";

                    if (isDark)
                    {
                        this.value = "dark";
                    }
                    else if (isLight)
                    {
                        this.value = "light";
                    }
                    else 
                    {
                        this.value = "system";
                    }
                });

                this.targetElementObserver.observe(element, { attributes: true, attributeFilter: ["class", "data-theme"] });
            }

            this.setValue();
        }
    }) target = "html";

    @property({
        after(this: ThemePicker, _value, old, initial) {
            if (initial) return;

            if (old === "local")
            {
                window.localStorage.removeItem("pap-theme");
            }

            if (old === "session")
            {
                window.sessionStorage.removeItem("pap-theme");
            }

            this.setValue();
        }
    }) storage?: "local" | "session";

    @property({
        after(this: ThemePicker) {
            this.setValue();
        }
    }) value: "dark" | "light" | "system" = "system";

    connectedCallback() {
        super.connectedCallback();

        const stored = this.storage === "local"
            ? localStorage.getItem("pap-theme")
            : this.storage === "session"
                ? sessionStorage.getItem("pap-theme")
                : null;

        if (stored === "dark" || stored === "light" || stored === "system")
        {
            this.value = stored;
        }
    }

    private setValue() {
        if (this.storage === "local")
        {
            window.localStorage.setItem("pap-theme", this.value);
        }

        if (this.storage === "session")
        {
            window.sessionStorage.setItem("pap-theme", this.value);
        }

        if (!document.startViewTransition)
        {
            this.toggleTheme();
        }
        else 
        {
            document.startViewTransition(() => {
                this.toggleTheme();
            })
        }

        this.dispatchEvent(new Event("change"));
        this.requestUpdate();
    }

    private toggleTheme() {
        if (!this.targetElement) return;

        this.internal = true;

        // SAFARI BUG, we must first set system...
        this.targetElement.classList.remove("theme-light");
        this.targetElement.classList.remove("theme-dark");
        this.targetElement.removeAttribute("data-theme");
        this.targetElement.style.colorScheme = ""; // SAFARI BUG 

        if (this.value !== "system") 
        {
            if (this.value === "light") this.targetElement.classList.remove("theme-dark");
            if (this.value === "dark") this.targetElement.classList.remove("theme-light");
            this.targetElement.setAttribute("data-theme", this.value);
            this.targetElement.style.colorScheme = this.value; // SAFARI BUG 
        }
        Promise.resolve().then(() => this.internal = false);
    }

    private handlemenuopen = () => {
        if (this.tooltipElement) this.tooltipElement.disabled = true;
        if (this.targetElement) 
        {
            const box = this.tooltipElement.getBoundingClientRect();
            const x = Math.round((box.x + box.width / 2) * 10) / 10;
            const y = Math.round((box.y + box.height / 2) * 10) / 10;
            this.targetElement.style.setProperty('--theme-transition-location', `${x}px ${y}px`);
        }
        // this.value = 'light';
    }
    private handletargetblur = () => {
        if (this.tooltipElement && this.tooltipElement.disabled) this.tooltipElement.disabled = false;
    }
    private handlemenuclose = () => {
        setTimeout(() => {
            if (this.buttonElement === document.activeElement) return;
            this.tooltipElement.disabled = false;
        }, 1);
    }

    render() {
        const t = (key: string) => key; // to be replaced by actual translation later 
        // but I thnk it makes sense to expose it at web-comoponent level since it anyway needs to deal with the effects etc

        let iconName = "computer";
        if (this.value === "light") iconName = "sun";
        if (this.value === "dark") iconName = "moon";


        return html`
            <pap-tooltip placement="top" >
                <span>${t("theme picker")}</span>
                <button @blur="${this.handletargetblur}" slot="target" popovertarget="menu">
                    <pap-icon name="${"/icons/" + iconName + ".svg"}"></pap-icon>
                </button>
            </pap-tooltip>
            <pap-menu 
                id="menu" 
                placement="bottom-right"
                @open="${this.handlemenuopen}"
                @close="${this.handlemenuclose}"
            >
                <pap-menuitem @click="${() => this.value = 'light'}">
                    <pap-icon name="/icons/sun.svg"></pap-icon>
                    <span>${t("light")}</span>
                </pap-menuitem>
                <pap-menuitem @click="${() => this.value = 'dark'}">
                    <pap-icon name="/icons/moon.svg"></pap-icon>
                    <span>${t("dark")}</span>
                </pap-menuitem>
                <pap-menuitem @click="${() => this.value = 'system'}">
                    <pap-icon name="/icons/computer.svg"></pap-icon>
                    <span>${t("system")}</span>
                </pap-menuitem>
            </pap-menu>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-theme-picker": ThemePicker;
    }
}