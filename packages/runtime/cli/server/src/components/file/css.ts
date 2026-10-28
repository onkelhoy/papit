/**
 * Rewrites the specifier of every CSS `@import` (quoted or `url()`, any media/layer suffix kept).
 * Relative, root-absolute and scheme URLs are left as they are. Any other specifier goes to
 * `resolve`: a string replaces it, `null` keeps it quietly (e.g. a local file), `undefined`
 * keeps it and lists it in `unresolved`.
 */
export function rewriteCssImports(css: string, resolve: (specifier: string) => string | null | undefined) {
    const unresolved: string[] = [];
    const swap = (specifier: string) => {
        if (/^(\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(specifier)) return specifier;
        const url = resolve(specifier);
        if (url === undefined) unresolved.push(specifier);
        return url ?? specifier;
    };

    const result = css.replace(
        /(@import\s+)(?:(url\(\s*)(["']?)([^"')\s]+)\3(\s*\))|(["'])([^"']+)\6)/g,
        (_match, at: string, open?: string, urlQuote?: string, urlSpecifier?: string, close?: string, quote?: string, specifier?: string) => {
            if (open !== undefined) return `${at}${open}${urlQuote}${swap(urlSpecifier!)}${urlQuote}${close}`;
            return `${at}${quote}${swap(specifier!)}${quote}`;
        },
    );

    return { css: result, unresolved };
}
