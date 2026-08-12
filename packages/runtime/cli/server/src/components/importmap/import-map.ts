import fs from "node:fs";
import path from "node:path";
import { Information, PackageNode } from "@papit/information";

import { type Importmap } from "./types";
import { pathToFileURL } from "node:url";

const TOOLCHAIN_PACKAGES = ["chokidar", "esbuild", "@microsoft/api-extractor", "typescript", "playwright"];

export function extractImportmap(
    node: PackageNode,
    map: Importmap,
    mapFolder: string,
    seen: Set<string> = new Set(),
) {
    if (seen.has(node.name)) return;
    seen.add(node.name);

    extractPackageJSON(
        node.name,
        node.location,
        node.packageJSON,
        map,
    );

    for (const depsField of ["dependencies", "devDependencies"] as const)
    {
        for (const name in node.packageJSON[depsField])
        {
            if (seen.has(name)) continue;
            if (TOOLCHAIN_PACKAGES.includes(name)) continue;
            // local/batch @papit packages get resolved via their own batch
            // entry in the caller's loop — skip only at that top level.
            if (name.startsWith(Information.scope) && node.name === Information.package.name) continue;

            const location = resolveNodeModule(node.location, name);
            if (!location) continue;

            const pkgLoc = path.join(location, "package.json");
            if (!fs.existsSync(pkgLoc)) continue;
            const packageJSON = JSON.parse(fs.readFileSync(pkgLoc, { encoding: "utf-8" }));

            extractPackageJSON(
                name,
                location,
                packageJSON,
                map,
                true,
            );

            extractImportmap(
                { name, location, packageJSON } as PackageNode,
                map,
                mapFolder,
                seen,
            );
        }
    }
}

// Walk up from `from`, checking each ancestor's node_modules/<name>,
// same resolution order Node itself uses for unhoisted/nested deps.
function resolveNodeModule(from: string, name: string): string | null {
    let dir = from;
    while (true)
    {
        const candidate = path.join(dir, "node_modules", name);
        if (fs.existsSync(candidate)) return candidate;

        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function extractPackageJSON(
    name: string,
    location: string,
    packageJSON: PackageNode['packageJSON'],
    map: Importmap,
    external = false,
) {

    const append = (name: string, packagepath: string) => {
        if (map.imports[name]) return;

        map.imports[name] = pathToFileURL(packagepath).pathname;
    }

    if (packageJSON.exports)
    {
        if (typeof packageJSON.exports === "string")
        {
            append(name, path.resolve(location, packageJSON.exports));
        }
        else 
        {
            for (const key in packageJSON.exports)
            {
                let name = packageJSON.name;
                if (key !== "." && key !== "default")
                {
                    // if (external) continue;
                    name += "/" + key.replace(/^\.?\/?/, '');
                }

                const value = typeof packageJSON.exports[key] === "string" ? packageJSON.exports[key] : packageJSON.exports[key]?.import;
                if (!value) continue;

                append(name, path.resolve(location, value));
            }
        }
    }

    if (packageJSON.main)
    {
        append(name, path.resolve(location, packageJSON.main));
    }
}