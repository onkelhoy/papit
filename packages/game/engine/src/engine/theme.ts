import type { Theme } from "../types";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The colour scheme an element is shown in. `data-theme` wins over the system through CSS. */
export function readTheme(element: Element): Theme {
    const scheme = getComputedStyle(element).colorScheme;
    if (scheme === "light" || scheme === "dark") return scheme;

    return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Calls back on a system theme switch and when the page sets `data-theme` or a theme class. */
export function watchTheme(callback: () => void) {
    matchMedia(DARK_QUERY).addEventListener("change", callback);
    new MutationObserver(callback).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
    });
}
