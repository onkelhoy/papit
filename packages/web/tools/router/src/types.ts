/** Values a path variable can take: the default first, then each fallback in order. */
export type Param = {
    default: string | undefined;
    fallback: string[];
}
/** A registered route. */
export type Route = {
    url: string; // ID of route 
    params: Record<string, Param>; // full scope of params based on default, fallback, and route + reroute variables 
    reroute: Array<string>; // redirected route - can be more then one in case failure
}

/** A route resolved to concrete urls. */
export type MappedRoute = {
    url: string; // reference to Route
    browser: string; // browser's url 
    request: string; // url used for fetching
    params: Record<string, string>;
}

/** Argument to `Router.addRoute`; only `url` is required. */
export type AddRoute = Partial<Omit<Route, 'url'>> & { url: string; };

export type SourceType = "style" | "script";
export type SourceElement = HTMLStyleElement | HTMLScriptElement | HTMLLinkElement;