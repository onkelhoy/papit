import fs from "node:fs";
import path from "node:path";

import type { SelectOptions, ShowcaseSource } from "./types";

/** Path of a package relative to `<root>/packages`, with forward slashes. */
export function packagePath(root: string, location: string) {
    return path.relative(path.join(root, "packages"), location).split(path.sep).join("/");
}

/** Every `papit.type` of a package; the object form lists one per entry point. */
export function packageTypes(source: ShowcaseSource): string[] {
    const type = source.packageJSON.papit?.type;
    if (!type) return [];
    if (typeof type === "string") return [type];
    return [...new Set(Object.values(type))];
}

/** Turns a path glob into a RegExp: `**` spans folders, `*` stays inside one. */
export function globToRegExp(glob: string) {
    let pattern = "";
    for (let i = 0; i < glob.length; i++)
    {
        const char = glob[i];
        if (char === "*" && glob[i + 1] === "*")
        {
            // "**/" also matches zero folders
            const slash = glob[i + 2] === "/";
            pattern += slash ? "(?:.*/)?" : ".*";
            i += slash ? 2 : 1;
        }
        else if (char === "*") pattern += "[^/]*";
        else if (char === "?") pattern += "[^/]";
        else pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${pattern}/?$`);
}

function matchesAny(value: string, globs: string[]) {
    // a plain folder glob ("web/design-system") also keeps everything inside it
    return globs.some(glob => globToRegExp(glob).test(value) || globToRegExp(glob.replace(/\/$/, "") + "/**").test(value));
}

/** Packages the showcase should list, in the order given. */
export function selectPackages(root: string, sources: ShowcaseSource[], options: SelectOptions = {}) {
    const types = options.types ?? [];
    const include = options.include ?? [];
    const exclude = options.exclude ?? [];

    return sources.filter(source => {
        if (source.packageJSON.papit?.skip) return false;

        const relative = packagePath(root, source.location);
        if (relative.startsWith("..")) return false;
        if (include.length > 0 && !matchesAny(relative, include)) return false;
        if (exclude.length > 0 && matchesAny(relative, exclude)) return false;
        if (types.length > 0 && !packageTypes(source).some(type => types.includes(type))) return false;
        if (options.viewsOnly && !fs.existsSync(path.join(source.location, "views"))) return false;

        return true;
    });
}
