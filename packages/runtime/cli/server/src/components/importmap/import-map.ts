import path from "node:path";
import { PackageNode } from "@papit/information";
import { type Importmap } from "./types";

export function extractImportmap(
    node: PackageNode,
    map: Importmap,
    mapFolder: string,
) {
    const append = (name: string, packagepath: string) => {
        if (map.imports[name]) return;

        map.imports[name] = packagepath;
    }

    if (node.packageJSON.exports)
    {
        if (typeof node.packageJSON.exports === "string")
        {
            append(node.name, path.join(node.location, node.packageJSON.exports));
        }
        else 
        {
            for (const key in node.packageJSON.exports)
            {
                let name = node.packageJSON.name;
                if (key !== "." && key !== "default")
                {
                    name += "/" + key.replace(/^\.?\/?/, '');
                }


                const value = typeof node.packageJSON.exports[key] === "string" ? node.packageJSON.exports[key] : node.packageJSON.exports[key]?.import;
                if (!value) continue;

                append(name, path.join(node.location, value));
            }
        }
    }

    if (node.packageJSON.main)
    {
        append(node.name, path.join(node.location, node.packageJSON.main));
    }

}