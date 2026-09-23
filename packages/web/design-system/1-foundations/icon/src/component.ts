import { CustomElement, html, property, unsafeHTML } from "@papit/web-component";
import sheet from "./style.css" with { type: "css" };
import { CountryEmojiSet } from "types";

/**
 * Renders an SVG icon inline from a URL, a spritesheet symbol (`url#id`) or a
 * name registered in `Icon.icons`, or a country flag emoji from `flag`.
 *
 * @element pap-icon
 * @slot - fallback content, rendered alongside the icon
 * @csspart svg - a fetched SVG
 * @csspart flag - the flag emoji wrapper
 * @csspart fallback - the default slot
 */
export class Icon extends CustomElement {
    static sheet = sheet;
    private controller = new AbortController();
    private viewBox = "0 0 24 24";
    private assignedName?: string;

    /** SVG markup by name, shared by every instance. Fetched icons are added here; set your own to skip the fetch. */
    static icons = new Map<string, string>(); //{ content: string, viewBox: string | null }>();
    static parser = new DOMParser();

    /** Keep fetched SVG text in localStorage under `storage` + URL. */
    @property({ type: Boolean }) cache = false;
    /** localStorage key prefix used when `cache` is on. */
    @property storage = "papit-icon";

    /** Registered name, bare name (fetched as `/<name>.svg`), URL, or `url#symbol-id`. */
    @property({
        rerender: true,
        async after(this: Icon, value: string) {
            let name = this.getName(value);

            if (Icon.icons.has(name))
            {
                // first we check if we hold a data pointed at our 
                this.assignedName = name;
                return;
            }

            if (!this.isUrl(value))
            {
                if (!value.startsWith("/")) value = "/" + value;
                if (!value.endsWith(".svg")) value += ".svg";
            }

            if (!this.isUrl(value))
            {
                console.log("[icon] not found in static icons and not URL, this icon can not exist");
                return;
            }

            // its URL and needs to be fetched 
            const rawUrl = value.split("#")?.at(0) ?? value;

            let rawdata = this.cache && window.localStorage.getItem(this.storage + rawUrl);
            if (!rawdata)
            {
                try
                {
                    const res = await fetch(rawUrl, { signal: this.controller.signal });
                    if (!/svg/i.test(res.headers.get("Content-Type") ?? ""))
                    {
                        throw "fetched response is not svg";
                    }
                    rawdata = await res.text();

                    if (this.cache)
                    {
                        window.localStorage.setItem(this.storage + rawUrl, rawdata);
                    }
                }
                catch (e)
                {
                    console.error("[icon] error could not fetch url", rawUrl);
                    console.error(e);
                    return;
                }
            }
            if (!rawdata)
            {
                console.error("[icon] no data found", value);
                return;
            }

            const parsed = Icon.parser.parseFromString(rawdata, "image/svg+xml");
            const parserError = parsed.querySelector("parsererror");
            if (parserError)
            {
                console.error("[icon] parse error:", parserError.textContent);
                return;
            }
            const svgElement = parsed.querySelector("svg");
            if (!svgElement)
            {
                console.error("[icon] parsed data did not yield SVG element");
                return;
            }

            const symbols = svgElement.querySelectorAll("symbol");
            if (symbols.length > 0)
            {
                // this is a spritesheet 
                for (let i = 0; i < symbols.length; i++)
                {
                    this.store(symbols[i], name + (i === 0 ? "" : i));
                }
            }
            else 
            {
                this.store(svgElement, name);
            }

            if (Icon.icons.has(name))
            {
                this.assignedName = name;
            }
        }
    }) name?: string;
    /** Two-letter country code rendered as a flag emoji; wins over `name`. */
    @property({
        rerender: true,
        set(value: string) {
            let final = "";
            for (let letter of value.toUpperCase())
            {
                final += CountryEmojiSet[letter];
            }

            return final;
        }
    }) flag?: string;

    private isUrl(value: string) {
        return /^(http|\.?\/)/.test(value);
    }
    private getName(value: string) {
        let name = value;
        const hashMatch = value.match(/#(?<name>\w+(?:-\w+)*)/);
        if (hashMatch?.groups)
        {
            return hashMatch.groups.name;
        }

        if (this.isUrl(name)) 
        {
            // then we just take the name 
            const potential = name.split("/").pop()?.split(".")?.at(0);
            if (!potential)
            {
                // not sure what to do here 
                return "missing-name";
            }

            return potential;
        }

        return name;
    }

    private store(element: SVGElement | SVGSymbolElement, name: string) {
        const id = element.id;
        if (id) name = id;
        else 
        {
            const title = element.querySelector("title");
            if (title?.textContent) name = title.textContent;
        }

        element.setAttribute("part", "svg");
        element.setAttribute("xmlns", "http://www.w3.org/2000/svg");

        // Icon.icons.set(name, { content: element.outerHTML.replace(/^\<symbol/, '<svg').replace(/symbol\>$/, 'svg>'), viewBox: element.getAttribute("viewBox") });
        Icon.icons.set(name, element.outerHTML.replace(/^\<symbol/, '<svg').replace(/symbol\>$/, 'svg>'));
    }

    connectedCallback() {
        super.connectedCallback?.();
        this.controller = new AbortController();
    }

    disconnectedCallback() {
        this.controller.abort("disconnectedCallback");
    }

    render() {
        const icon = !this.flag && this.assignedName && Icon.icons.get(this.assignedName);

        return html`
            <slot part="fallback"></slot>
            ${this.flag && html`<span part="flag">${this.flag}</span>`}
            
            ${icon && unsafeHTML(icon)}
        `;
    }
}
