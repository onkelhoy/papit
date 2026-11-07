import type { ShowcaseManifest, ShowcaseRoute } from "./types";

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
