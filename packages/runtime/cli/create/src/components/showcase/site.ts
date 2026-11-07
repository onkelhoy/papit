import fs from "node:fs";
import path from "node:path";

import { buildTree } from "./tree";
import type { ShowcaseEntry, ShowcaseManifest, ShowcaseSource } from "./types";

export type SiteOptions = {
    /** Workspace root; its README becomes the home page. */
    root: string;
    /** Root package name and version, shown in the shell. */
    name: string;
    version: string;
    /** Selected packages and their manifest entries, same order. */
    sources: ShowcaseSource[];
    entries: ShowcaseEntry[];
    /** Template folder copied as the site shell. */
    template: string;
    /** Site folder, emptied first. */
    output: string;
    /** Replaces VARIABLE_TITLE in template files. */
    title?: string;
};

/**
 * Files and folders copied per package: source name → name in the site.
 * `views` and `asset` are renamed because @papit/static skips folders with those names.
 */
const PACKAGE_FILES: Record<string, string> = {
    "views": "view",
    "asset": "files",
    "README.md": "README.md",
    "analyse.json": "analyse.json",
};

/**
 * Writes the showcase site: the template shell, `manifest.json`, the root README,
 * and per package its views (`view/`), assets (`files/`), README and analyse.json under `packages/<path>/`.
 */
export function writeSite(options: SiteOptions): ShowcaseManifest {
    const output = path.resolve(options.output);
    const root = path.resolve(options.root);
    if (output === root || !path.relative(output, root).startsWith(".."))
    {
        throw new Error(`showcase output "${output}" must not be or contain the workspace root`);
    }

    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { recursive: true });

    copyTemplate(options.template, output, options.title ?? options.name);

    const readme = path.join(root, "README.md");
    if (fs.existsSync(readme)) fs.copyFileSync(readme, path.join(output, "README.md"));

    options.sources.forEach((source, index) => {
        const target = path.join(output, "packages", options.entries[index].path);
        for (const file in PACKAGE_FILES)
        {
            const from = path.join(source.location, file);
            if (!fs.existsSync(from)) continue;
            fs.cpSync(from, path.join(target, PACKAGE_FILES[file]), { recursive: true, filter: src => !/[\\/](node_modules|\.temp)([\\/]|$)/.test(src) });
        }
    });

    const manifest: ShowcaseManifest = {
        name: options.name,
        version: options.version,
        readme: fs.existsSync(readme),
        tree: buildTree(options.entries),
        packages: options.entries,
    };
    fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));

    return manifest;
}

function copyTemplate(template: string, output: string, title: string) {
    fs.cpSync(template, output, { recursive: true });

    for (const file of ["index.html", "main.js"])
    {
        const target = path.join(output, file);
        if (!fs.existsSync(target)) continue;
        fs.writeFileSync(target, fs.readFileSync(target, "utf-8").replace(/VARIABLE_TITLE/g, title));
    }
}
