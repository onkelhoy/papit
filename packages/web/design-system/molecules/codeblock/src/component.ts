// import statements 
// system 
import { bind, CustomElement, debounce, html, property, query, unsafeHTML } from "@papit/web-component";
import "@papit/icon";
import "@papit/splitter";
import "@papit/switch";
import "@papit/tooltip";
import { useTranslator, translator, TransalatorFn } from "@papit/translator/browser";
import { Switch } from "@papit/switch";

// local 
import sheet from "./style.css" assert { type: "css" };
import { html as formatHTML } from "formatters/html";

/**
 * Displays formatted, syntax-highlighted code with a live preview.
 * Supports light/dark scheme toggling relative to the ambient color scheme.
 * @element pap-codeblock
 */
export class Codeblock extends CustomElement {
    static sheet = sheet;
    // static sheets = [githubTheme];

    // properties 
    @query("div[part=\"display\"] button") copyButton!: HTMLButtonElement;

    /**
     * Background style for the preview area.
     * - `canvas` — solid canvas color
     * - `background` — solid background color  
     * - `checker` — checkerboard pattern (useful for transparency checks)
     * @default "checker"
     */
    @property color: "canvas" | "background" | "checker" = "checker";
    @property display: "both" | "code" | "raw" = "both";

    private content = "";
    private timer: NodeJS.Timeout | null = null;
    private t = useTranslator().t;
    private dispose?: () => void;

    //#region COLOR-SCHEME
    private ambientScheme!: "light" | "dark";
    private mediaQuery = matchMedia("(prefers-color-scheme: dark)");
    private observer = new MutationObserver(() => this.updateAmbient());
    private orignalHTML: string;

    constructor() {
        super();

        const serialize = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) return node.textContent ?? '';

            if (!(node instanceof Element)) return "";

            const children = Object.values(node.childNodes).map(serialize).join("");
            const tag = node.tagName.toLowerCase();

            let attrs = "";
            if (node instanceof CustomElement)
            {
                attrs = node.originalAttributes
                    .map(a => `${a.name}="${a.value}"`)
                    .join(' ');
            }
            else 
            {
                attrs = Array.from(node.attributes)
                    .map(a => `${a.name}="${a.value}"`)
                    .join(' ');
            }

            return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
        }

        this.orignalHTML = Array.from(this.childNodes).map(serialize).join('');
        this.content = formatHTML(this.orignalHTML);
    }

    connectedCallback() {
        super.connectedCallback?.();
        // watch system preference
        this.mediaQuery.addEventListener("change", this.handleschemechange);

        // watch ancestors for style/class changes that could affect color-scheme
        let node: Element | null = this.parentElement;
        while (node)
        {
            this.observer.observe(node, { attributes: true, attributeFilter: ["style", "class"] });
            node = node.parentElement;
        }

        this.dispose = translator.subscribe(() => {
            this.requestUpdate();
        })
        this.updateAmbient();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.mediaQuery.removeEventListener("change", this.handleschemechange);
        this.observer.disconnect();

        if (this.dispose) this.dispose();
    }


    @bind
    private handleswitch(e: Event) {
        if (!(e.target instanceof Switch)) return;
        const checked = e.target.checked;

        this.style.colorScheme = checked
            ? (this.ambientScheme === "dark" ? "light" : "dark")
            : this.ambientScheme;
    }

    @bind
    private handleschemechange() {
        this.updateAmbient();
    }

    private updateAmbient() {
        const prev = this.ambientScheme;

        // temporarily clear our own override so getComputedStyle reads the inherited value
        const own = this.style.colorScheme;
        this.style.colorScheme = "";
        this.ambientScheme = getComputedStyle(this).colorScheme === "light" ? "light" : "dark";
        this.style.colorScheme = own;

        if (prev !== this.ambientScheme)
        {
            // ambient changed — re-sync if switch is in its default (unchecked) position
            const sw = this.shadowRoot?.querySelector("pap-switch");
            if (sw instanceof Switch && !sw.checked)
            {
                this.style.colorScheme = this.ambientScheme;
            }
        }
    }

    //#endregion

    // event handlers
    @bind
    private handlecopy() {
        navigator.clipboard.writeText(this.orignalHTML).then(() => {
            console.log("Copied to clipboard");
            if (this.timer !== null) clearTimeout(this.timer);

            this.copyButton.classList.add('copied');
            this.timer = setTimeout(() => {
                this.copyButton.classList.remove('copied');
            }, 2000);
        }, (err) => {
            console.error('Failed to copy text: ', err);
        });
    }

    render() {
        return html`
            <div part="display">
                <header>
                    <pap-tooltip>
                        <span>${this.t("Theme Toggle")}</span>
                        <pap-switch slot="target" @change="${this.handleswitch}"></pap-switch>
                    </pap-tooltip>

                    <pap-tooltip placement="top-right">
                        <span>${this.t("Copy Code")}</span>
                        <button slot="target" @click="${this.handlecopy}">
                            <pap-icon name="done"></pap-icon>
                            <pap-icon name="copy"></pap-icon>
                        </button>
                    </pap-tooltip>
                </header>
                <pap-splitter value="90">
                    <section slot="primary" part="primary">
                        <slot></slot>
                    </section>
                    <div slot="secondary"></div>
                </pap-splitter>
            </div>

            <div part="code">
                <pre><code>${unsafeHTML(this.content)}</code></pre>
                <details>
                    <summary>
                        <pap-icon name="chevron-down"></pap-icon>
                    </summary>
                </details>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-codeblock": Codeblock;
    }
}