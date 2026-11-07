import fs from "node:fs";
import path from "node:path";

import { packagePath, packageTypes } from "./select";
import type { ShowcaseEntry, ShowcaseSource } from "./types";

/**
 * View folder names (folders in `views/` with an index.html).
 * With a filter only those views are kept, in filter order; without one all are kept, `showcase` first.
 */
export function listViews(location: string, filter?: string[]) {
    const folder = path.join(location, "views");
    if (!fs.existsSync(folder)) return [];

    const views = fs
        .readdirSync(folder, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && fs.existsSync(path.join(folder, entry.name, "index.html")))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const order = filter && filter.length > 0 ? filter : ["showcase"];
    const rank = (view: string) => {
        const index = order.indexOf(view);
        return index === -1 ? order.length : index;
    };

    return views
        .filter(view => !filter || filter.length === 0 || filter.includes(view))
        .sort((a, b) => rank(a) - rank(b));
}

/** Every file under `folder`, relative to it, with forward slashes. */
export function listFiles(folder: string): string[] {
    if (!fs.existsSync(folder)) return [];

    const files: string[] = [];
    const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true }))
        {
            if (entry.name.startsWith(".")) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(path.relative(folder, full).split(path.sep).join("/"));
        }
    };
    walk(folder);
    return files.sort();
}

/** The manifest entry for one package. `workspace` holds every workspace package name. */
export function describePackage(root: string, source: ShowcaseSource, workspace: Set<string>, viewFilter?: string[]): ShowcaseEntry {
    const json = source.packageJSON;
    const assets = listFiles(path.join(source.location, "asset"));

    return {
        name: source.name,
        version: json.version ?? "0.0.0",
        description: json.description ?? "",
        type: packageTypes(source),
        path: packagePath(root, source.location),
        views: listViews(source.location, viewFilter),
        readme: fs.existsSync(path.join(source.location, "README.md")),
        analyse: fs.existsSync(path.join(source.location, "analyse.json")),
        assets,
        translations: assets
            .filter(file => /^translations\/[^/]+\.json$/.test(file))
            .map(file => path.basename(file, ".json")),
        dependencies: Object.keys(json.dependencies ?? {}).filter(name => workspace.has(name)),
    };
}
