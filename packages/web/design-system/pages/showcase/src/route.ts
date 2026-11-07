import type { ShowcaseEntry, ShowcaseManifest, ShowcaseRoute } from "./types";

/** The path in a showcase hash, without `#`, leading or trailing slashes: `#/web/router/` → `web/router`. */
export function hashPath(hash: string) {
    return hash.replace(/^#/, "").replace(/^\/+|\/+$/g, "");
}

/** The hash for a package page: `href("web/router", "showcase")` → `#/web/router/showcase`. */
export function href(path: string, page?: string) {
    return "#/" + [path, page].filter(Boolean).join("/");
}

/**
 * Resolves a hash against the manifest. The longest package path that prefixes the hash wins;
 * the one segment after it is the page.
 */
export function resolveRoute(hash: string, manifest?: ShowcaseManifest): ShowcaseRoute {
    const path = hashPath(hash);
    if (!path || !manifest) return {};

    let best: ShowcaseRoute | null = null;
    for (const entry of manifest.packages)
    {
        if (path !== entry.path && !path.startsWith(entry.path + "/")) continue;
        if (best?.entry && best.entry.path.length >= entry.path.length) continue;

        const rest = path.slice(entry.path.length + 1);
        if (rest.includes("/")) continue;
        best = rest ? { entry, page: rest } : { entry };
    }

    return best ?? { unknown: path };
}

/** Auto pages the showcase renders itself, in menu order. */
export const AUTO_PAGES = ["api", "assets", "translations"] as const;
export type AutoPage = typeof AUTO_PAGES[number];

/** Asset files that are previewed (translations have their own page). */
export function previewAssets(entry: ShowcaseEntry) {
    return entry.assets.filter(file => !file.startsWith("translations/"));
}

/** Every page of a package: its views, then the auto pages it has data for. */
export function pagesOf(entry: ShowcaseEntry): string[] {
    const auto: string[] = [];
    if (entry.analyse) auto.push("api");
    if (previewAssets(entry).length > 0) auto.push("assets");
    if (entry.translations.length > 0) auto.push("translations");
    return [...entry.views, ...auto];
}
