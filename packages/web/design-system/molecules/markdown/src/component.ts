// import statements
// system
import { CustomElement, html, property, query, bind } from "@papit/web-component";
import { markdown, type MarkdownBlock, type MarkdownInline } from "@papit/lexer";

// local
import sheet from "./style.css" with { type: "css" };

export class Markdown extends CustomElement {
    static sheet = sheet;

    private controller: AbortController | null = null;
    private observer: MutationObserver | null = null;
    // the fetched `src` text, and the URL its relative links resolve against
    private fetched: string | null = null;
    private base: URL | null = null;

    /** URL of a markdown file to fetch and render, used when `content` isn't set. */
    @property({
        after(this: Markdown) {
            this.load();
        }
    }) src?: string;

    /** Markdown to render. Wins over `src` and the element's own text. */
    @property({
        after(this: Markdown) {
            this.paint();
        }
    }) content?: string;

    @query({
        selector: "div[part='content']",
        // load runs before the property is assigned
        load(this: Markdown, element: HTMLDivElement) {
            this.container = element;
            this.paint();
        }
    }) private container!: HTMLDivElement;

    connectedCallback() {
        super.connectedCallback();

        // the element's own text is the fallback source, so follow its changes
        this.observer = new MutationObserver(this.handlemutation);
        this.observer.observe(this, { childList: true, characterData: true, subtree: true });
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        this.observer?.disconnect();
        this.observer = null;
        this.controller?.abort();
    }

    /** The markdown currently rendered: `content`, else the fetched `src`, else the element's own text. */
    get markdown() {
        if (this.content != null) return this.content;
        if (this.src) return this.fetched ?? "";
        return dedent(this.textContent ?? "");
    }

    // event handlers
    @bind
    private handlemutation() {
        if (this.content == null && !this.src) this.paint();
    }

    // an in-page anchor points into the shadow root, which the document's hash can't reach
    @bind
    private handleclick(e: MouseEvent) {
        const anchor = (e.target as Element).closest?.("a");
        const href = anchor?.getAttribute("href");
        if (!href?.startsWith("#")) return;

        const target = this.shadowRoot?.getElementById(decodeURIComponent(href.slice(1)));
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ block: "start" });
    }

    private async load() {
        this.controller?.abort();
        this.controller = null;
        this.fetched = null;
        this.base = null;

        if (!this.src)
        {
            this.paint();
            return;
        }

        const controller = new AbortController();
        this.controller = controller;
        try
        {
            const url = new URL(this.src, document.baseURI);
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

            const text = await response.text();
            if (controller.signal.aborted) return;

            this.fetched = text;
            this.base = url;
            this.paint();
            this.dispatchEvent(new Event("load"));
        }
        catch (error)
        {
            if (controller.signal.aborted) return;
            this.paint();
            this.dispatchEvent(new CustomEvent("error", { detail: { error } }));
        }
    }

    private paint() {
        if (!this.container) return;

        const slugs = new Map<string, number>();
        const fragment = document.createDocumentFragment();
        for (const block of markdown(this.markdown)) fragment.append(this.block(block, slugs));
        this.container.replaceChildren(fragment);
    }

    // ---------------------------------------------------------------- DOM
    // only elements and text nodes are built, markdown text is never parsed as HTML

    private block(block: MarkdownBlock, slugs: Map<string, number>, tight = false): Node {
        switch (block.type)
        {
            case "heading":
            {
                const heading = this.element(`h${block.level}`, block.children);
                heading.id = slug(heading.textContent ?? "", slugs);
                return heading;
            }
            case "paragraph":
            {
                // a tight list item holds its text without a <p>
                if (tight)
                {
                    const fragment = document.createDocumentFragment();
                    for (const child of block.children) fragment.append(this.inline(child));
                    return fragment;
                }
                return this.element("p", block.children);
            }
            case "code":
            {
                const pre = document.createElement("pre");
                const code = document.createElement("code");
                if (block.lang)
                {
                    code.className = `language-${block.lang}`;
                    pre.dataset.lang = block.lang;
                }
                code.textContent = block.text;
                pre.append(code);
                return pre;
            }
            case "quote":
            {
                const quote = document.createElement("blockquote");
                for (const child of block.children) quote.append(this.block(child, slugs));
                return quote;
            }
            case "list":
            {
                const list = document.createElement(block.ordered ? "ol" : "ul");
                if (block.ordered && block.start !== 1) list.setAttribute("start", String(block.start));

                for (const item of block.items)
                {
                    const li = document.createElement("li");
                    if (item.checked !== undefined)
                    {
                        const box = document.createElement("input");
                        box.type = "checkbox";
                        box.checked = item.checked;
                        box.disabled = true;
                        li.className = "task";
                        li.append(box);
                    }
                    for (const child of item.children) li.append(this.block(child, slugs, !block.loose));
                    list.append(li);
                }
                return list;
            }
            case "table":
            {
                const table = document.createElement("table");
                const row = (cells: MarkdownInline[][], tag: "th" | "td") => {
                    const tr = document.createElement("tr");
                    cells.forEach((cell, index) => {
                        const element = this.element(tag, cell);
                        if (block.align[index]) element.style.textAlign = block.align[index]!;
                        tr.append(element);
                    });
                    return tr;
                };

                const head = document.createElement("thead");
                head.append(row(block.head, "th"));
                table.append(head);

                if (block.rows.length)
                {
                    const body = document.createElement("tbody");
                    for (const cells of block.rows) body.append(row(cells, "td"));
                    table.append(body);
                }

                // wide tables scroll on their own
                const wrapper = document.createElement("div");
                wrapper.className = "table";
                wrapper.append(table);
                return wrapper;
            }
            case "rule":
                return document.createElement("hr");
        }
    }

    private element(tag: string, children: MarkdownInline[]) {
        const element = document.createElement(tag);
        for (const child of children) element.append(this.inline(child));
        return element;
    }

    private inline(node: MarkdownInline): Node {
        switch (node.type)
        {
            case "text":
                return document.createTextNode(node.text);
            case "break":
                return document.createElement("br");
            case "code":
            {
                const code = document.createElement("code");
                code.textContent = node.text;
                return code;
            }
            case "image":
            {
                const src = this.url(node.src, false);
                if (!src) return document.createTextNode(node.alt);

                const image = document.createElement("img");
                image.src = src;
                image.alt = node.alt;
                image.loading = "lazy";
                if (node.title) image.title = node.title;
                return image;
            }
            case "link":
            {
                const href = this.url(node.href, true);
                if (!href) return this.element("span", node.children);

                const anchor = this.element("a", node.children) as HTMLAnchorElement;
                anchor.setAttribute("href", href);
                if (node.title) anchor.title = node.title;
                if (!href.startsWith("#") && new URL(href, document.baseURI).origin !== location.origin)
                {
                    anchor.target = "_blank";
                    anchor.rel = "noopener noreferrer";
                }
                return anchor;
            }
            default:
                return this.element(node.type, node.children);
        }
    }

    // http(s) and relative URLs, plus mailto for links; relative ones resolve against a fetched `src`
    private url(raw: string, link: boolean): string | null {
        if (link && raw.startsWith("#")) return raw;
        try
        {
            const url = new URL(raw, this.base ?? document.baseURI);
            const allowed = url.protocol === "http:" || url.protocol === "https:" || (link && url.protocol === "mailto:");
            if (!allowed) return null;
            return this.base ? url.href : raw;
        }
        catch
        {
            return null;
        }
    }

    render() {
        return html`
            <div part="content" @click="${this.handleclick}"></div>
        `
    }
}

// text written inside the element: drop the outer blank lines and the indentation the lines share.
// The first line is left out of the count, since HTML formatters often trim it
function dedent(text: string) {
    const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return "";

    const rest = lines.slice(1).filter(line => line.trim());
    const indent = rest.length ? Math.min(...rest.map(line => line.length - line.trimStart().length)) : 0;
    return [lines[0].trimStart(), ...lines.slice(1).map(line => line.slice(Math.min(indent, line.length - line.trimStart().length)))].join("\n");
}

// GitHub style heading ids: lowercase, spaces to dashes, repeats get -1, -2…
function slug(text: string, slugs: Map<string, number>) {
    const base = text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-");
    const count = slugs.get(base) ?? 0;
    slugs.set(base, count + 1);
    return count ? `${base}-${count}` : base;
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-markdown": Markdown;
    }
}
