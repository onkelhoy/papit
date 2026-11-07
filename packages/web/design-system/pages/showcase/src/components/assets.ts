// system
import { CustomElement, html, property } from "@papit/web-component";

// tools
import { translate, useTranslator } from "@papit/translator";

// local
import sheet from "./assets.css" with { type: "css" };
import { previewAssets } from "../route";
import type { ShowcaseEntry } from "../types";

const IMAGE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i;
const AUDIO = /\.(mp3|wav|ogg|m4a|flac)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;

/** Which preview a file gets, by extension. */
export function assetKind(file: string): "image" | "audio" | "video" | "file" {
    if (IMAGE.test(file)) return "image";
    if (AUDIO.test(file)) return "audio";
    if (VIDEO.test(file)) return "video";
    return "file";
}

/**
 * Previews every file in a package's `asset/` folder: images and icons in a grid,
 * audio and video with native players, anything else as a download link.
 *
 * @element pap-showcase-assets
 */
export class ShowcaseAssets extends CustomElement {
    static sheet = sheet;

    @translate t = useTranslator("showcase.assets");

    /** The package whose assets are shown. */
    @property({ type: Object, attribute: false, rerender: true }) entry?: ShowcaseEntry;
    /** Site base URL the package files resolve against. */
    @property({ rerender: true }) base = "";

    private url(file: string) {
        return new URL(`packages/${this.entry!.path}/files/${file}`, this.base || document.baseURI).href;
    }

    private renderGroup(kind: string, files: string[]) {
        if (files.length === 0) return null;

        return html`
            <section aria-label="${this.t(kind)}">
                <h2>${this.t(kind)} <small>(${files.length})</small></h2>
                <ul part="${kind}">
                    ${files.map(file => {
                        const url = this.url(file);
                        if (kind === "image") return html`
                            <li><figure>
                                <img src="${url}" alt="" loading="lazy" />
                                <figcaption><a href="${url}" download>${file}</a></figcaption>
                            </figure></li>
                        `;
                        if (kind === "audio") return html`<li><span>${file}</span><audio controls preload="none" src="${url}"></audio></li>`;
                        if (kind === "video") return html`<li><span>${file}</span><video controls preload="none" src="${url}"></video></li>`;
                        return html`<li><a href="${url}" download>${file}</a></li>`;
                    })}
                </ul>
            </section>
        `;
    }

    render() {
        if (!this.entry) return null;

        const groups: Record<string, string[]> = { image: [], audio: [], video: [], file: [] };
        for (const file of previewAssets(this.entry)) groups[assetKind(file)].push(file);

        return html`${Object.keys(groups).map(kind => this.renderGroup(kind, groups[kind]))}`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-showcase-assets": ShowcaseAssets;
    }
}
