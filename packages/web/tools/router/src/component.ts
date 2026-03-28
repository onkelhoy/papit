// system 
import { CustomElement, property, html, debounce, query, bind, generateUUID } from "@papit/web-component";

// local imports
import { Route, AddRoute, MappedRoute, SourceElement, SourceType } from "./types";
// helper imports 
import { extract, intermediate, candidateGenerator } from "helper/route";
import { fetchURL } from "helper/fetch";
import { format, join, tidy } from "helper/url";
import { hash } from "helper/utils";
import { proxy } from "helper/proxy";

export class Router extends CustomElement {

    // static variables
    private static parser: DOMParser;
    private static encoder: TextEncoder;
    // private variables
    private sources: Set<string> = new Set();
    private hasinitiated = false;
    private internalpopstate = false; // prevents browser-url to be set if true
    // public variables
    public UUID!: string;
    public safeUUID!: string;
    public routes: Route[] = [];
    public browser_url: string | undefined = undefined;
    public route: MappedRoute | null = null;
    public abortcontrollers: Set<AbortController> = new Set();

    // queries
    @query({
        selector: '#router-dom',
        load: function (this: Router) {
            this.initiateurl();
        }
    }) dom!: HTMLDivElement;
    @query({
        selector: '#router-head',
        load: function (this: Router) {
            this.initiateurl();
        }
    }) head!: HTMLDivElement;
    @query({
        selector: '#router-body',
        load: function (this: Router) {
            this.initiateurl();
        }
    }) body!: HTMLDivElement;

    // properties
    @property({ type: Boolean, rerender: false, attribute: "update-title" }) updatetitle: boolean = true;
    @property({ type: Boolean, rerender: false, attribute: "update-url", after: console.log }) updateurl: boolean = true;
    @property({
        type: Boolean,
        rerender: false,
        attribute: "trailing-slash",
    }) trailingslash: boolean = true;
    @property({ type: Array, rerender: false, attribute: false }) omitters: string[] = ["[data-server-omitter]"];
    @property({ rerender: false }) cache: "session" | "local" | undefined = undefined;
    @property({
        rerender: false,
        after: function (this: Router) {
            this.doupdateurl();
        }
    }) url?: string;
    @property({
        type: Boolean,
        rerender: false,
        attribute: "hash-based",
        after: function (this: Router) {
            this.initiateurl();
        }
    }) hashbased?: boolean;

    // getters 
    get params() {
        if (!this.route) return {};
        return this.route.params;
    }

    constructor() {
        super();
        if (!Router.parser) Router.parser = new DOMParser();
        if (!Router.encoder) Router.encoder = new TextEncoder();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.UUID = generateUUID();
        this.safeUUID = this.UUID.replaceAll(/\W/g, "");
        window.addEventListener("popstate", this.handlewindowpopstate);

        // add proxy here!
        proxy(this);
    }
    disconnectedCallback(): void {
        super.disconnectedCallback();

        this.abortcontrollers.forEach(control => control.abort("router disconnected"));
        this.abortcontrollers.clear();
        window.removeEventListener("popstate", this.handlewindowpopstate);
    }
    firstRender(): void {
        super.firstRender();

        // init url 
    }

    // event handlers 
    @bind
    private handleslotchange(e: Event) {
        if (e.target instanceof HTMLSlotElement)
        {
            const assignedElements = e.target.assignedElements();

            for (let element of assignedElements)
            {
                const route = extract(element);
                if (route) this.routes.push(route);
            }
        }
    }
    @bind
    private handlewindowpopstate(event: PopStateEvent) {
        if (event.state?.url)
        {
            // Handle state restoration here
            this.internalpopstate = true;
            this.url = event.state.url;
        }
        else
        {
            if (this.hashbased)
            {
                this.url = tidy(window.location.pathname) + tidy(window.location.hash.replace("#", ""));
            }
            else this.cleanup();
        }
    }

    // public functions 
    public addRoute(route: AddRoute) {
        const mappedroute: Route = {
            params: {},
            reroute: [route.url],
            ...route, // override the above if so 
        };

        this.routes.push(mappedroute);
    }

    // private functions 
    @debounce(150)
    private initiateurl() {
        if (!this.hasinitiated)
        {
            this.doupdateurl();
        }
    }
    private async doupdateurl() {
        if (!this.dom) return;
        if (!this.head) return;
        if (!this.body) return;

        if (this.browser_url === undefined)
        {
            let browser_url = tidy(window.location.pathname);
            let url = tidy(this.url);

            if (!url.startsWith(browser_url))
            {
                // this means url is set aside from browser_url thus found initial browser_url
                this.browser_url = "/" + browser_url;
            }
            else
            {
                this.browser_url = "";
            }
        }

        this.hasinitiated = true;

        if (this.url === undefined)
        {
            let browser_url = this.browser_url;
            if (this.hashbased)
            {
                this.url = tidy(window.location.hash.replace("#", ""));
                browser_url = format(join(browser_url, "#"), this.trailingslash)
            }
            if (this.updateurl)
            {
                const REALBROWSERURL = window.location.href.slice(window.location.origin.length);
                if (!REALBROWSERURL.startsWith(browser_url))
                {
                    window.history.replaceState(null, '', browser_url);
                }
            }
            return;
        }

        this.route = null;
        const route = intermediate(this.url, this.routes);
        if (!route) return;

        const gen = candidateGenerator(route, this.browser_url, this);
        for (let candidate of gen)
        {
            const data = await fetchURL(candidate.request, candidate, this);
            if (!(data.response && data.response.ok)) continue;

            this.route = candidate;
            if (this.updateurl && !this.internalpopstate)
            {

                const REALBROWSERURL = window.location.href.slice(window.location.origin.length);
                if (this.route.browser !== REALBROWSERURL)
                {
                    // Push the new state into the history
                    window.history.pushState({ url: this.url }, '', this.route.browser);
                }
            }
            this.internalpopstate = false;

            this.insertHTML(data.content, data.response);
            break;
        }

        if (this.route === null)
        {
            console.log('no route could be determined');
        }
    }
    private cleanup() {
        const sources = this.head.querySelectorAll(":not([data-proxy])");
        sources.forEach(element => this.head.removeChild(element));
        this.body.innerHTML = "";
    }
    private async insertHTML(content: string, response: Response) {
        const contenttype = response.headers.get('content-type');

        if (contenttype !== "text/html")
        {
            throw new Error("fetched something besides html..");
        }

        // cleanup always scripts until smart solution can be made to reload window-load on already existing scripts
        const currentScripts = this.head.querySelectorAll("script[data-hash]");
        for (let i = 0; i < currentScripts.length; i++)
        {
            this.head.removeChild(currentScripts[i]);
        }

        const dom = Router.parser.parseFromString(content, "text/html");

        // first remove any elements that are defined by omitters 
        for (let omiter of this.omitters)
        {
            const elements = dom.querySelectorAll(omiter);
            elements.forEach(element => {
                element.parentNode?.removeChild(element);
            });
        }

        const scripts = dom.querySelectorAll<HTMLScriptElement>("script");
        const links = dom.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
        const styles = dom.querySelectorAll<HTMLStyleElement>("style");

        const list: Array<{ elm: SourceElement, type: SourceType }> = [];
        scripts.forEach(elm => list.push({ elm, type: "script" }));
        links.forEach(elm => list.push({ elm, type: "style" }));
        styles.forEach(elm => list.push({ elm, type: "style" }));

        // iterate sources 
        for (const item of list)
        {
            await this.handlesource(item.elm, item.type);

            // since we add the body we dont want the sources
            item.elm.parentNode?.removeChild(item.elm);
        }

        // cleanup existing sources (that was not just added)
        for (let i = 0; i < this.head.children.length; i++)
        {
            const child = this.head.children[i];
            if (child.hasAttribute("data-proxy")) continue;
            const hash = child.getAttribute("data-hash") || "";

            if (!this.sources.has(hash))
            {
                child.parentNode?.removeChild(child);
                i--;
            }
        }

        this.sources.clear();

        const body = dom.querySelector("body");
        const headstuff = dom.querySelectorAll("head > *:not(title)");
        if (headstuff && this.updatetitle)
        {
            const title = dom.querySelector("title");

            if (title)
            {
                const domtitle = document.querySelector("title");
                if (domtitle) domtitle.innerHTML = title.innerHTML;
            }
        }

        if (body) this.body.innerHTML = body.innerHTML;

        this.dispatchEvent(new Event("window-clear"));
        this.dispatchEvent(new Event("window-load"));
    }
    private async handlesource(element: SourceElement, type: SourceType) {
        let content = element.textContent;
        const url = element.getAttribute(type === "script" ? "src" : "href");

        if (url)
        {
            const route = this.route as MappedRoute;
            const data = await fetchURL("/" + join(route.request, url), route as MappedRoute, this);
            if (data.content)
            {
                content = data.content;
            }
        }

        if (!content)
        {
            console.error("[router] content could not be loaded", element);
            return;
        }

        const h = await hash(content, Router.encoder);
        this.sources.add(h); // append to latest sources 

        content = this.fixcontent(content, type);

        // append proxy script first 

        if (!this.head.querySelector(`[data-hash="${h}"]`))
        {
            // no hash found 
            const child = document.createElement(type);
            child.textContent = content;
            child.setAttribute("data-hash", h);
            child.setAttribute("key", h);

            for (let attribute of element.attributes)
            {
                if (!["src", "href", "rel"].includes(attribute.name))
                {
                    child.setAttribute(attribute.name, attribute.value);
                }
            }

            this.head.appendChild(child);
        }
    }
    private fixcontent(content: string, type: SourceType) {
        if (type === "style")
        {
            // replace with a look-behind & look-ahead to ensure we dont remove any necessary info (CSS info)
            return content.replaceAll(/(?<=\W|^)body(?=\W|$)/g, "div#router-body");
        }

        // replace reference to document to window.document
        content = content.replaceAll(/(?<![\w'"`])(window\.)?document(?![\w])/g, "window.document"); //`window.proxy_document_${this.safeUUID}`);
        // replace reference to location to window.location
        content = content.replaceAll(/(?<![\w'"`])(window\.|document\.)?location(?![\w])/g, "window.location"); //, `window.proxy_location_${this.safeUUID}`);

        // replace references to window to window.proxy_ ...
        content = content.replaceAll(/(?<![\w'"`])window(?=[\.])/g, `window.proxy_${this.safeUUID}`);

        return content;
    }

    render() {
        return html`
      <slot @slotchange="${this.handleslotchange}"></slot>
      <div id="router-dom">
        <div id="router-head"></div>
        <div id="router-body"></div>
      </div>
    `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-router": Router;
    }
}