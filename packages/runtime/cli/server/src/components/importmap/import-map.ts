import fs from "node:fs";
import path from "node:path";
import { Information, PackageNode } from "@papit/information";

import { type Importmap } from "./types";
import { pathToFileURL } from "node:url";

export function extractImportmap(
    node: PackageNode,
    map: Importmap,
    mapFolder: string,
) {

    extractPackageJSON(
        node.name,
        node.location,
        node.packageJSON,
        map,
    );

    for (const name in node.packageJSON.dependencies) 
    {
        if (name.startsWith(Information.scope)) continue;
        if (["chokidar", "esbuild", "@microsoft/api-extractor", "typescript", "playwright"].includes(name)) continue;

        const location = path.join(Information.root.location, "node_modules", name);
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