// system
import { CustomElement, html, property } from "@papit/web-component";

// foundations
import "@papit/button";
import "@papit/icon";

// atoms
import "@papit/menu";

// tools
import { effect } from "@papit/signals";
import { translator, translate, useTranslator, type LanguageJson } from "@papit/translator";

// local
import sheet from "./style.css" with { type: "css" };
import type { LanguageOption } from "./types";

/** A language's meta, also before it's been made current (inline translations carry it). */
function languageMeta(language: LanguageJson) {
    return language.meta ?? language.translations?.meta;
}

/** Region of a language: `meta.region`, else the part after `-` in the id or language (`sv-SE` → `SE`). */
export function languageRegion(language: LanguageJson) {
    const meta = languageMeta(language);
    if (meta?.region) return meta.region.toUpperCase();
    const code = meta?.language ?? language.id;
    const region = code.split(/[-_]/)[1];
    return region && /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : undefined;
}

/**
 * Menu for choosing the active `@papit/translator` language. The trigger shows the current
 * language's flag cropped to a circle; each item shows a flag and the language name, named in
 * the current language through `Intl.DisplayNames`.
 *
 * @element pap-language-picker
 * @fires change - after the language changed through the picker
 * @csspart trigger - the round flag button
 * @csspart flag - the round flag wrappers
 */
export class LanguagePicker extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator("language-picker");
    private dispose?: () => void;

    /** Where the menu opens relative to the trigger. */
    @property({ rerender: true }) placement = "bottom-right";

    connectedCallback() {
        super.connectedCallback();
        // re-render when languages are added, not only when the current one changes
        this.dispose = effect(() => {
            translator.list();
            this.requestUpdate();
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.dispose?.();
        this.dispose = undefined;
    }

    /** The languages to pick from, named in the current language. */
    get options(): LanguageOption[] {
        const locale = translator.locale() ?? undefined;
        let names: Intl.DisplayNames | null = null;
        try { names = new Intl.DisplayNames(locale ? [locale] : [], { type: "language" }) }
        catch { names = null }

        return translator.list().map(language => {
            const code = languageMeta(language)?.language ?? language.id;
            let name = code;
            try { name = names?.of(code) ?? code }
            catch { name = code }
            return { id: language.id, name, region: languageRegion(language) };
        });
    }

    private async select(id: string) {
        if (translator.current()?.id === id) return;
        await translator.change(id);
        this.dispatchEvent(new Event("change"));
    }

    render() {
        const current = translator.current();
        const region = current ? languageRegion(current) : undefined;
        const options = this.options;
        const currentName = options.find(option => option.id === current?.id)?.name ?? "";

        return html`
            <pap-button
                part="trigger"
                size="icon"
                variant="clear"
                color="secondary"
                popovertarget="menu"
                aria-label="${this.t("label", { language: currentName })}"
            >
                ${region
                    ? html`<span part="flag" aria-hidden="true"><pap-icon flag="${region}"></pap-icon></span>`
                    : html`<pap-icon aria-hidden="true" name="globe"></pap-icon>`}
            </pap-button>

            <pap-menu id="menu" placement="${this.placement}">
                ${options.map(option => html`
                    <pap-menuitem
                        lang="${option.id}"
                        aria-current="${option.id === current?.id ? "true" : ""}"
                        @click="${() => this.select(option.id)}"
                    >
                        ${option.region
                            ? html`<span part="flag" aria-hidden="true"><pap-icon flag="${option.region}"></pap-icon></span>`
                            : ""}
                        <span>${option.name}</span>
                    </pap-menuitem>
                `)}
            </pap-menu>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-language-picker": LanguagePicker;
    }
}
