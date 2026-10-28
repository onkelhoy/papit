import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Arguments } from "@papit/arguments";
import { Information, type PackageNode } from "@papit/information";
import { Terminal } from "@papit/terminal";
import { Element } from "@papit/html";
import { getESOptions, jsBundle } from "@papit/bundle-js";
import { createInline, meta } from "@papit/server";

import {
    dependencyPath,
    fetchShim,
    isTooling,
    normalizeBase,
    packageEntries,
    planAssets,
    planTranslations,
    resolveSpecifier,
    resolveTarget,
    rewriteCssImports,
    rewriteImportmap,
} from "./plan";
import type { StaticOptions, StaticResult } from "../types";

// never published from the page folder: build output, tooling, tests and other views
const SKIP = new Set(["node_modules", ".git", ".temp", "lib", "dist", "src", "tests", "views", "test-reports", "test-results"]);
const SCRIPT = /\.(m?js|tsx?)$/;

/**
 * Writes the static site for the package the process runs in (`Information.package`): the
 * page folder picked by `resolveTarget`, its scripts bundled, plus `lib/`, `public/` and `.nojekyll`.
 * @throws Error when no page folder is found, or when `output` is, or contains, it
 */
export async function build(options: StaticOptions): Promise<StaticResult> {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const output = path.resolve(cwd, options.output ?? "dist");
    const base = normalizeBase(options.base);
    const node = Information.package;

    const folder = resolveTarget({
        cwd,
        packageLocation: node.location,
        packageName: node.name,
        target: options.target,
        isDir: location => fs.existsSync(location) && fs.statSync(location).isDirectory(),
        hasHtml: location => fs.readdirSync(location).some(name => name.endsWith(".html")),
    });

    if (output === folder || isInside(folder, output))
    {
        throw new Error(`output "${output}" would overwrite the page folder "${folder}"`);
    }

    if (!Arguments.has("live-template"))
    {
        Arguments.set("live-template", path.join(packageRoot(fileURLToPath(import.meta.url)), "asset", "templates", "static", "index.html"));
    }

    const data = await meta();

    try
    {
        fs.mkdirSync(output, { recursive: true });
        const assetFolders = ["asset", "assets", "public", ...(Arguments.get("asset") ?? [])];

        // public/: assets (closest package wins) and merged translations
        const serverAsset = path.join(data.serverPackageLocation, "asset");
        const devOnly = [path.join(serverAsset, "templates") + path.sep, path.join(serverAsset, "icons", "explorer-spritesheet.svg")];
        const assets = planAssets(data.assets, assetFolders, file => !devOnly.some(skip => file.startsWith(skip)));
        const translations = planTranslations(data.translations);

        for (const out in assets.files) copyFile(assets.files[out]!, path.join(output, "public", out));
        for (const out in translations.files) write(path.join(output, "public", out), JSON.stringify(translations.files[out]));

        const urls: Record<string, string> = {};
        for (const key in assets.urls) urls[key] = base + "public/" + assets.urls[key];
        for (const key in translations.urls) urls[key] = base + "public/" + translations.urls[key];

        // lib/: the import map without tooling, every workspace dependency's exports (the server
        // leaves some out, e.g. CSS-only packages) and node_modules packages, transitively
        const imports: Record<string, string> = {};
        for (const name in data.importmap.imports)
        {
            if (!isTooling(name)) imports[name] = data.importmap.imports[name]!;
        }

        const packages: Parameters<typeof resolveSpecifier>[1] = {};
        for (const dependency of Information.getBatches().flat())
        {
            if (dependency.type === "root") continue;
            packages[dependency.name] = { root: dependency.location, packageJSON: dependency.packageJSON };
            addEntries(imports, packageEntries(dependency.name, dependency.location, dependency.packageJSON));
        }

        const externals = addExternals(imports, node.location);
        for (const root of externals)
        {
            const packageJSON = readJSON(path.join(root, "package.json"));
            if (!packages[packageJSON.name]) packages[packageJSON.name] = { root, packageJSON };
        }

        const copied = new Set<string>();
        const locate = (file: string) => {
            const root = packageRoot(file);
            const name = readJSON(path.join(root, "package.json")).name as string;
            // a package ships only the top folder holding the file (e.g. lib/), never all of itself
            const source = path.join(root, path.relative(root, file).split(path.sep)[0]!);

            if (!copied.has(source))
            {
                copied.add(source);
                const target = path.join(output, ...dependencyPath(name, root, source).split("/"));
                fs.cpSync(source, target, { recursive: true, filter: src => path.basename(src) !== "node_modules" });
            }

            return dependencyPath(name, root, file);
        };

        const importmap = rewriteImportmap(imports, base, locate);

        // node_modules packages' asset folders, below every workspace asset
        for (const root of externals)
        {
            for (const assetFolder of assetFolders)
            {
                const from = path.join(root, assetFolder);
                if (!fs.existsSync(from)) continue;
                for (const file of fs.readdirSync(from, { recursive: true, encoding: "utf-8" }))
                {
                    const source = path.join(from, file);
                    const target = path.join(output, "public", file);
                    if (fs.statSync(source).isFile() && !fs.existsSync(target)) copyFile(source, target);
                }
            }
        }

        // the page folder
        const scriptExternals = [node.name, ...node.externals, ...Object.keys(imports)].flatMap(name => [name, name + "/*"]);
        const pages: string[] = [];
        for (const file of crawl(folder, output, new Set(assetFolders)))
        {
            const relative = path.relative(folder, file);
            const target = path.join(output, relative);

            if (SCRIPT.test(file) && !file.endsWith(".d.ts"))
            {
                write(target.replace(/\.tsx?$/, ".js"), await compile(file, node, scriptExternals));
            }
            else if (file.endsWith(".html"))
            {
                const document = createInline(node, { absolute: file, relative }, importmap, data.serverPackageLocation);
                inject(document.head!, fetchShim(urls));
                for (const script of document.querySelectorAll("script[src]"))
                {
                    const src = script.getAttribute("src");
                    if (typeof src === "string" && !src.includes("://") && /\.tsx?$/.test(src)) script.setAttribute("src", src.replace(/\.tsx?$/, ".js"));
                }
                write(target, document.outerHTML);
                pages.push(relative.split(path.sep).join("/"));
            }
            else
            {
                copyFile(file, target);
            }
        }

        // CSS @imports of every copied stylesheet; resolving one can copy another package into
        // lib/, so repeat until no new stylesheet shows up
        const done = new Set<string>();
        let pending = stylesheets(output).filter(file => !done.has(file));
        while (pending.length > 0)
        {
            for (const file of pending)
            {
                done.add(file);
                const result = rewriteCssImports(fs.readFileSync(file, "utf-8"), specifier => {
                    if (fs.existsSync(path.join(path.dirname(file), specifier))) return null;
                    const resolved = resolveSpecifier(specifier, packages);
                    return resolved ? base + locate(resolved) : undefined;
                });
                for (const specifier of result.unresolved)
                {
                    Terminal.warn("unresolved @import", `"${specifier}"`, "in", path.relative(output, file));
                }
                write(file, result.css);
            }
            pending = stylesheets(output).filter(file => !done.has(file));
        }

        write(path.join(output, ".nojekyll"), "");

        return {
            folder,
            pages,
            assets: Object.keys(assets.files).length,
            translations: Object.keys(translations.files).length,
            dependencies: copied.size,
        };
    }
    finally
    {
        if (data.createdImportMapFolder && data.importmapFolder)
        {
            fs.rmSync(data.importmapFolder, { recursive: true, force: true });
            const temp = path.dirname(data.importmapFolder);
            if (path.basename(temp) === ".temp" && fs.existsSync(temp) && fs.readdirSync(temp).length === 0)
            {
                fs.rmSync(temp, { recursive: true, force: true });
            }
        }
    }
}

function addEntries(imports: Record<string, string>, entries: Record<string, string>) {
    for (const specifier in entries)
    {
        if (!imports[specifier]) imports[specifier] = pathToFileURL(entries[specifier]!).pathname;
    }
}

function stylesheets(folder: string) {
    return fs.readdirSync(folder, { recursive: true, encoding: "utf-8" })
        .filter(file => file.endsWith(".css"))
        .map(file => path.join(folder, file));
}

// adds node_modules packages to the import map: those it already points into, and the
// dependencies of `location` that aren't mapped yet, then their dependencies, transitively;
// returns the root of every node_modules package in it
function addExternals(imports: Record<string, string>, location: string) {
    const roots = new Set<string>();
    const queue: string[] = [];
    const visit = (root: string) => {
        if (roots.has(root)) return;
        roots.add(root);
        queue.push(root);
    };

    for (const name in imports)
    {
        const file = fileURLToPath("file://" + imports[name]);
        if (file.includes(path.sep + "node_modules" + path.sep)) visit(packageRoot(file));
    }

    const dependencies = (root: string) => {
        const packageJSON = readJSON(path.join(root, "package.json"));
        for (const name of Object.keys({ ...packageJSON.dependencies, ...packageJSON.peerDependencies }))
        {
            if (isTooling(name) || (root === location && imports[name])) continue;
            const dependency = resolveModule(name, root);
            if (!dependency) continue;

            addEntries(imports, packageEntries(name, dependency, readJSON(path.join(dependency, "package.json"))));
            visit(dependency);
        }
    };

    dependencies(location);
    while (queue.length > 0) dependencies(queue.shift()!);

    return roots;
}

async function compile(file: string, node: PackageNode, externals: string[]) {
    const esoptions = getESOptions(Arguments.instance, node.location, { packageJSON: node.packageJSON, externals });
    if (esoptions.tsconfig && !fs.existsSync(esoptions.tsconfig)) delete esoptions.tsconfig;

    // the call @papit/server's bundler makes, with the minifying build options
    let content: string | undefined;
    await jsBundle(
        Arguments.instance,
        node.location,
        {
            entryPointArray: [{ input: file, output: undefined }],
            tsconfig: node.tsconfig,
            externals,
            packageJSON: node.packageJSON,
            esoptions: { ...esoptions, write: false },
        },
        info => {
            if (info.type === "build") content = info.result.outputFiles?.at(0)?.text;
        },
    );

    if (content === undefined) throw new Error(`could not compile "${file}"`);
    return content;
}

function inject(head: Element, shim: string) {
    // the template's placeholder is its first script, so createInline places the import map
    // before it (anchoring on a template node, not a parsed page node); it then carries the asset map
    const placeholder = head.querySelector("script[data-papit-static]");
    const script = placeholder ?? head.ownerDocument.createElement("script");
    script.removeAttribute("data-papit-static");
    script.textContent = shim;

    if (!placeholder) head.appendChild(script); // a custom --live-template without the placeholder
}

// every file of the page folder, minus skipped folders and asset folders (published via public/)
function crawl(folder: string, output: string, assetFolders: Set<string>) {
    const files: string[] = [];
    const walk = (location: string) => {
        for (const entry of fs.readdirSync(location, { withFileTypes: true }))
        {
            const child = path.join(location, entry.name);
            if (entry.isDirectory())
            {
                if (SKIP.has(entry.name) || assetFolders.has(entry.name) || child === output) continue;
                walk(child);
            }
            else if (entry.isFile())
            {
                files.push(child);
            }
        }
    };

    walk(folder);
    return files;
}

function resolveModule(name: string, from: string) {
    let folder = from;
    while (true)
    {
        const location = path.join(folder, "node_modules", name);
        if (fs.existsSync(path.join(location, "package.json"))) return location;
        const parent = path.dirname(folder);
        if (parent === folder) return null;
        folder = parent;
    }
}

// nearest folder above `file` whose package.json has a name (skips e.g. dist/package.json type markers)
function packageRoot(file: string) {
    let folder = path.dirname(file);
    while (folder !== path.dirname(folder))
    {
        const location = path.join(folder, "package.json");
        if (fs.existsSync(location) && readJSON(location).name) return folder;
        folder = path.dirname(folder);
    }
    throw new Error(`no package.json above "${file}"`);
}

function readJSON(file: string) {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function isInside(child: string, parent: string) {
    const relative = path.relative(parent, child);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function copyFile(source: string, target: string) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

function write(target: string, content: string) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
}
