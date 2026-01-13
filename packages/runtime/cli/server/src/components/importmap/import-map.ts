import path from "node:path";
import fs from "node:fs";
// import { getLockfilePackagePath, getPackage, getPathInfo, LocalPackage, Lockfile } from "@papit/util";
import { Information, PackageNode } from "@papit/information";
import { Importmap } from "./types";

export function extractImportmap(
    node: PackageNode,
    map: Importmap,
    mapFolder: string,
) {

    const append = (packagepath: string) => {
        if (map.imports[node.name]) return;

        map.imports[node.name] = packagepath;
    }

    if (node.packageJSON.exports)
    {
        if (typeof node.packageJSON.exports === "string")
        {
            append(path.join(node.location, node.packageJSON.exports));
        }
        else 
        {
            for (const key in node.packageJSON.exports)
            {
                let name = node.packageJSON.name;
                if (key !== "." && key !== "default")
                {
                    name += "/" + key;
                }

                const value = typeof node.packageJSON.exports[key] === "string" ? node.packageJSON.exports[key] : node.packageJSON.exports[key]?.import;
                if (!value) continue;

                append(path.join(node.location, value));
            }
        }
    }

    if (node.packageJSON.main)
    {
        append(path.join(node.location, node.packageJSON.main));
    }

}

// export function build(
//     info: ReturnType<typeof getPathInfo>,
//     packageJSON: LocalPackage,
//     lockfile: Lockfile | null,
//     location: string,
//     map: Importmap,
//     mapFolder: string,
//     originPackageJSON: LocalPackage | null,
//     originMeta: Awaited<ReturnType<typeof getMeta>> | undefined,
// ) {

//     const append = (packagepath: string) => {
//         const name = packageJSON.name;
//         if (map.imports[name]) return;

//         // NOTE, theres an inherit problem, - dependencies which are not 
//         let destination: string;
//         if (info.root !== info.local)
//         {
//             let localran = false;
//             if (originPackageJSON?.name === name && originMeta && info.local === info.package)
//             {
//                 let mainKey: string | undefined;
//                 for (const key of originMeta.entryPoints.keys)
//                 {
//                     if (key === "bundle" || key === "default" || key === "main") 
//                     {
//                         mainKey = key;
//                         break;
//                     }
//                     else if (!mainKey) mainKey = key;
//                 }

//                 if (mainKey && originMeta.entryPoints.record[mainKey])
//                 {
//                     localran = true;
//                     destination = path.resolve(info.package, originMeta.entryPoints.record[mainKey]);
//                 }
//             }

//             if (!localran)
//             {
//                 if (!fs.existsSync(packagepath)) return;
//                 destination = path.join(mapFolder, path.relative(info.root, packagepath));
//                 fs.mkdirSync(path.dirname(destination), { recursive: true });
//                 fs.copyFileSync(packagepath, destination);
//             }
//         }
//         else 
//         {
//             const _packagepath = getLockfilePackagePath(name, lockfile!);
//             if (!_packagepath) return;

//             const outputfile = path.relative(path.join(info.root, _packagepath), packagepath);
//             const final = `node_modules/${name}/${outputfile}`

//             if (!lockfile?.packages[`node_modules/${name}`]) return;
//             destination = final;
//         }

//         map.imports[name] = "/" + path.relative(info.local, destination!);
//     }

//     if (packageJSON.exports)
//     {
//         if (typeof packageJSON.exports === "string")
//         {
//             append(path.join(location, packageJSON.exports));
//         }
//         else 
//         {
//             for (const key in packageJSON.exports)
//             {
//                 let name = packageJSON.name;
//                 if (key !== "." && key !== "default")
//                 {
//                     name += "/" + key;
//                 }

//                 const value = typeof packageJSON.exports[key] === "string" ? packageJSON.exports[key] : packageJSON.exports[key]?.import;
//                 if (!value) continue;

//                 append(path.join(location, value));
//             }
//         }
//     }

//     if (packageJSON.main)
//     {
//         append(path.join(location, packageJSON.main));
//     }


//     // we need to make sure any dependencies are added as well - but lets take this hit another time
//     // if (lockfile)
//     // {
//     //   const dependencies = Object.keys(packageJSON.dependencies ?? {}).concat(Object.keys(packageJSON.peerDependencies ?? {}));
//     //   for (const dep of dependencies)
//     //   {
//     //     const pkg = getPackage(dep, lockfile);
//     //     // pkg.
//     //   }
//     // }
// }