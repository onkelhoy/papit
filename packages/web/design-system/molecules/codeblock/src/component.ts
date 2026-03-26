// import statements 
// system 
import { bind, CustomElement, debounce, html, property, query, unsafeHTML } from "@papit/web-component";
import "@papit/icon";
import "@papit/splitter";
import "@papit/switch";
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
    @property({ type: Boolean }) display = false;

    private content = "";
    private timer: NodeJS.Timeout | null = null;

    //#region COLOR-SCHEME
    private ambientScheme!: "light" | "dark";
    private mediaQuery = matchMedia("(prefers-color-scheme: dark)");
    private observer = new MutationObserver(() => this.updateAmbient());

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

        this.updateAmbient();
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.mediaQuery.removeEventListener("change", this.handleschemechange);
        this.observer.disconnect();
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
        navigator.clipboard.writeText(this.originalHTML).then(() => {
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

    @bind
    private handleslotchange(e: Event) {
        this.originalHTML = this.innerHTML.replace(/<!--(\d+)-->/i, '');
        this.content = formatHTML(this.originalHTML);

        console.log('change?', this.content)
        this.requestUpdate();
    }

    render() {
        return html`
            <div part="display">
                <header>
                    <pap-switch @change="${this.handleswitch}"></pap-switch>
                    <button @click="${this.handlecopy}">
                        <pap-icon name="done"></pap-icon>
                        <pap-icon name="content_paste"></pap-icon>
                    </button>
                </header>
                <pap-splitter value="90">
                    <section slot="primary">
                        <slot @slotchange="${this.handleslotchange}"></slot>
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