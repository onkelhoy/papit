export type Param = {
    default: string | undefined;
    fallback: string[];
}
export type Route = {
    url: string; // ID of route 
    params: Record<string, Param>; // full scope of params based on default, fallback, and route + reroute variables 
    reroute: Array<string>; // redirected route - can be more then one in case failure
}

export type MappedRoute = {
    url: string; // reference to Route
    browser: string; // browser's url 
    request: string; // url used for fetching
    params: Record<string, string>;
}

export type AddRoute = Partial<Omit<Route, 'url'>> & { url: string; };

export type SourceType = "style" | "script";
export type SourceElement = HTMLStyleElement | HTMLScriptElement | HTMLLinkElement;