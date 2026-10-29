import path from "node:path";
import { fileURLToPath } from "node:url";

/** Output path (relative, forward slashes) → source, plus request path → output path. */
export type Plan<T> = {
    files: Record<string, T>;
    urls: Record<string, string>;
};

function posix(value: string) {
    return value.split(path.sep).join("/");
}

/**
 * The URL prefix every generated URL starts with. Always starts and ends with `/`,
 * unless it is an absolute URL (`https://…`), which only gets the trailing slash.
 * @default "/"
 */
export function normalizeBase(base?: string) {
    let value = (base ?? "").trim();
    if (!value.includes("://") && !value.startsWith("/")) value = "/" + value;
    if (!value.endsWith("/")) value += "/";
    return value;
}

/**
 * The path of a package-relative asset file below its asset folder,
 * e.g. `asset/icons/x.svg` → `icons/x.svg`. `null` when no segment is an asset folder.
 */
export function assetPath(relative: string, assetFolders: string[]) {
    const segments = posix(relative).split("/").filter(Boolean);
    const index = segments.findIndex(segment => assetFolders.includes(segment));
    if (index < 0 || index === segments.length - 1) return null;
    return segments.slice(index + 1).join("/");
}

/**
 * Picks one source per output path from the server's asset table (request path → files,
 * closest package last). The closest package wins a shared path; the others are skipped.
 * `urls` maps every request path the dev server answers to the output path it would serve.
 */
export function planAssets(
    assets: Record<string, string[]>,
    assetFolders: string[],
    filter: (file: string) => boolean = () => true,
): Plan<string> {
    // the longest request path of a file is its path relative to its package
    const relative = new Map<string, string>();
    for (const key in assets)
    {
        for (const file of assets[key]!)
        {
            const current = relative.get(file);
            if (!current || key.length > current.length) relative.set(file, key);
        }
    }

    const output = new Map<string, string>();
    for (const [file, key] of relative)
    {
        if (!filter(file)) continue;
        const out = assetPath(key, assetFolders);
        if (out) output.set(file, out);
    }

    const files: Record<string, string> = {};
    const urls: Record<string, string> = {};
    for (const key in assets)
    {
        const winner = assets[key]!.filter(file => output.has(file)).at(-1);
        if (!winner) continue;

        urls[posix(key)] = output.get(winner)!;
    }

    // every file sits in the list of the request path equal to its output path, in package
    // order, so the last file there with that output path is the closest package's copy
    for (const out of new Set(output.values()))
    {
        const list = assets[path.join(path.sep, ...out.split("/"))] ?? [];
        const winner = list.filter(file => output.get(file) === out).at(-1);
        if (winner) files[out] = winner;
    }

    return { files, urls };
}

/** One merged JSON file per language under `translations/`, and the request paths that load it. */
export function planTranslations(translations: {
    data: Record<string, unknown>;
    map: Record<string, string>;
}): Plan<unknown> {
    const files: Record<string, unknown> = {};
    const urls: Record<string, string> = {};

    for (const lang in translations.data)
    {
        files[`translations/${lang}.json`] = translations.data[lang];
    }

    for (const key in translations.map)
    {
        const lang = translations.map[key]!;
        if (!(lang in translations.data)) continue;
        urls[key] = `translations/${lang}.json`;
    }

    return { files, urls };
}

/** Output path of a package file: `lib/<name>/<path inside the package>`. */
export function dependencyPath(name: string, packageRoot: string, file: string) {
    return `lib/${name}/${posix(path.relative(packageRoot, file))}`;
}

/**
 * Rewrites the server's import map (values are URL-encoded filesystem paths) to `base` + the
 * output path `locate` returns for each file.
 */
export function rewriteImportmap(
    imports: Record<string, string>,
    base: string,
    locate: (file: string) => string,
) {
    const rewritten: Record<string, string> = {};
    for (const name in imports)
    {
        rewritten[name] = base + locate(fileURLToPath("file://" + imports[name]));
    }
    return { imports: rewritten };
}

/**
 * Inline script that sends `fetch` calls for a mapped same-origin path to its static URL,
 * standing in for the dev server's asset lookup (e.g. `/en.json`, `/icons/x.svg`).
 */
export function fetchShim(urls: Record<string, string>) {
    const json = JSON.stringify(urls).replace(/</g, "\\u003c");
    return `(()=>{const m=${json};const f=window.fetch;window.fetch=function(i,o){if(typeof i==="string"||i instanceof URL){const u=new URL(i,location.href);if(u.origin===location.origin&&Object.prototype.hasOwnProperty.call(m,decodeURIComponent(u.pathname)))i=m[decodeURIComponent(u.pathname)]+u.search+u.hash}return f.call(this,i,o)}})();`;
}

/**
 * The file a bare specifier (`name` or `@scope/name`, optional subpath) points at, through the
 * package's `exports`/`main` (`packageEntries`). A subpath of a package without `exports` is
 * the file at that path. `undefined` when the package is unknown or doesn't export it.
 */
export function resolveSpecifier(
    specifier: string,
    packages: Record<string, { root: string; packageJSON: Parameters<typeof packageEntries>[2] }>,
) {
    const parts = specifier.split("/");
    const length = specifier.startsWith("@") ? 2 : 1;
    const name = parts.slice(0, length).join("/");
    const subpath = parts.slice(length).join("/");

    const entry = packages[name];
    if (!entry) return undefined;

    const file = packageEntries(name, entry.root, entry.packageJSON)[specifier];
    if (file) return file;
    if (subpath && !entry.packageJSON.exports) return path.resolve(entry.root, subpath);
    return undefined;
}

/**
 * The folder whose pages are published. With `target`: `<cwd>/<target>`, then
 * `<cwd>/views/<target>`. Without: the cwd when it holds `.html` files, then
 * `<package>/views/github`, then `<package>/views/<package name without scope>`.
 * @throws Error naming every folder tried
 */
export function resolveTarget(options: {
    cwd: string;
    packageLocation: string;
    packageName: string;
    target?: string;
    isDir: (folder: string) => boolean;
    hasHtml: (folder: string) => boolean;
}) {
    const { cwd, packageLocation, packageName, target, isDir, hasHtml } = options;

    const tried = target
        ? [path.resolve(cwd, target), path.resolve(cwd, "views", target)]
        : [cwd, path.join(packageLocation, "views", "github"), path.join(packageLocation, "views", packageName.split("/").at(-1)!)];

    const found = target
        ? tried.find(isDir)
        : tried.find((folder, index) => index === 0 ? isDir(folder) && hasHtml(folder) : isDir(folder));

    if (!found)
    {
        const what = target ? `--target "${target}"` : "a page folder";
        throw new Error(`could not find ${what}, tried:\n  ${tried.join("\n  ")}`);
    }

    return found;
}

/**
 * Import map entries of a package from its package.json `exports` (string, `import` or
 * `default` condition; wildcard subpaths skipped) and `main`, as absolute files.
 */
export function packageEntries(
    name: string,
    root: string,
    packageJSON: { main?: string; exports?: string | Record<string, unknown> },
) {
    const entries: Record<string, string> = {};
    const add = (specifier: string, file: unknown) => {
        if (typeof file !== "string" || specifier.includes("*") || entries[specifier]) return;
        entries[specifier] = path.resolve(root, file);
    };

    if (typeof packageJSON.exports === "string")
    {
        add(name, packageJSON.exports);
    }
    else if (packageJSON.exports)
    {
        for (const key in packageJSON.exports)
        {
            const value = packageJSON.exports[key] as string | { import?: unknown; default?: unknown } | undefined;
            const file = typeof value === "string" ? value : value?.import ?? value?.default;
            add(key === "." ? name : `${name}/${key.replace(/^\.?\//, "")}`, file);
        }
    }

    if (packageJSON.main) add(name, packageJSON.main);
    return entries;
}

const TOOLING = new Set(["@playwright/test", "playwright", "typescript", "esbuild", "chokidar", "@microsoft/api-extractor"]);

/** True for build and test tooling (and `@types/*`), which never belongs in a published site. */
export function isTooling(specifier: string) {
    const parts = specifier.split("/");
    const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
    return TOOLING.has(name) || name.startsWith("@types/");
}
