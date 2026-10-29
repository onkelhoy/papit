import fs from "node:fs";
import path from "node:path";
import { Information, PackageNode } from "@papit/information";

import { type Importmap } from "./types";
import { pathToFileURL } from "node:url";

export function extractImportmap(
    node: PackageNode,
    map: Importmap,
    mapFolder: string,
    externals?: Set<string>,
) {
    extractPackageJSON(
        node.name,
        node.location,
        node.packageJSON,
        map,
    );

    const visited = new Set<string>();
    for (const name in node.packageJSON.dependencies) 
    {
        extractExternal(name, Information.root.location, map, visited);
    }

    for (const name in node.packageJSON.devDependencies) 
    {
        extractExternal(name, Information.root.location, map, visited);
    }

    visited.forEach(location => externals?.add(location));
}

const TOOLING = ["chokidar", "esbuild", "@microsoft/api-extractor", "typescript", "playwright"];

// maps an external package and, transitively, its own dependencies; each one resolves from
// the dependent's node_modules first, then the root's, so nested versions are found
function extractExternal(
    name: string,
    from: string,
    map: Importmap,
    visited: Set<string>,
) {
    if (name.startsWith(Information.scope)) return;
    if (TOOLING.includes(name)) return;

    const location = [path.join(from, "node_modules", name), path.join(Information.root.location, "node_modules", name)]
        .find(location => fs.existsSync(path.join(location, "package.json")));
    if (!location || visited.has(location)) return;
    visited.add(location);

    const packageJSON = JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));

    extractPackageJSON(
        name,
        location,
        packageJSON,
        map,
        true,
    );

    for (const dependency in packageJSON.dependencies)
    {
        extractExternal(dependency, location, map, visited);
    }
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