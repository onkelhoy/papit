import path from "node:path";
// import fs from "node:fs";
import { ServerResponse } from "node:http";

// import { Arguments } from "@papit/arguments";
// import { Terminal } from "@papit/terminal";
// import { deepMergeTwo } from "@papit/deep-merge";

import { extractTranslation, type Translation, type Translations } from "./translation";
// import { deepMerge } from "./util";
import { NotFoundError } from "components/errors";
import { getFILE } from "components/file/get";
import { Cache } from "components/file/cache";
import { Information } from "@papit/information";

// export async function extractAssets(
//     root: string,
//     location: string,
//     translations: Translations,
//     assets: Record<string, string[]>,
//     folders: string[],
//     deep = 0,
// ) {
//     if (!fs.existsSync(location) || deep > 10) return;

//     const FFs = fs.readdirSync(location)

//     for (const name of FFs)
//     {
//         const url = path.join(location, name)
//         const stat = fs.statSync(url)

//         if (!stat.isDirectory()) continue

//         const lowerName = name.toLowerCase()

//         if (lowerName.startsWith("translation"))
//         {
//             await extractTranslation(url, translations)
//             continue  // don't recurse into translation folders
//         }

//         if (folders.includes(lowerName))
//         {
//             // found an asset folder — harvest its files
//             await handleAsset(root, url, translations, assets, folders)
//             continue  // don't recurse further into it
//         }

//         // not an asset folder — keep looking deeper
//         await extractAssets(root, url, translations, assets, folders, deep + 1)
//     }
// }

// asset.ts — just registers a file into assets/translations
export function handleAsset(
    location: string,
    file: string,
    assets: Record<string, string[]>,
) {
    const relativeURL = path.relative(location, file);
    const segments = relativeURL.split(path.sep);

    while (segments.length > 0)
    {
        const joined = "/" + segments.join("/");
        if (!assets[joined]) assets[joined] = [];
        assets[joined].push(file);
        segments.shift();
    }
}


// export async function handleAsset(
//     root: string,
//     location: string,
//     translations: Record<string, Translation>,
//     assets: Record<string, string[]>,
//     folders: string[], // [assets|public|files]
//     deep = 0,
// ) {
//     if (!fs.existsSync(location)) return;

//     // files and folders
//     const FFs = fs.readdirSync(location); // .filter(name => fs.statSync(path.join(location, name)).isDirectory());

//     for (const name of FFs) 
//     {
//         const url = path.join(location, name);
//         console.log("handle asset", { name, url })
//         const stat = fs.statSync(url);

//         if (stat.isFile())
//         {
//             const relativeURL = path.relative(root, url);
//             const absoluteURL = '/' + relativeURL;
//             if (!assets[absoluteURL]) assets[absoluteURL] = [];
//             assets[absoluteURL].push(url);

//             const segments = relativeURL.split(path.sep);
//             // Remove first segment if it's an asset folder
//             if (folders.includes(segments[0]))
//             {
//                 segments.shift();
//                 const relativeURL = '/' + segments.join('/');

//                 if (!assets[relativeURL]) assets[relativeURL] = [];
//                 assets[relativeURL].push(url);
//             }
//         }

//         if (stat.isDirectory())
//         {
//             const lowerName = name.toLowerCase();
//             if (lowerName.startsWith("translation"))
//             {
//                 await extractTranslation(url, translations);
//                 return;
//             }

//             if (deep < 10)
//             {
//                 console.log("looking recursivle", url)
//                 await handleAsset(root, url, translations, assets, folders, deep + 1);
//             }
//             else if (Arguments.warning)
//             {
//                 Terminal.warn("max asset depth reached", url);
//             }
//         }
//     }
// }


export async function streamAsset(
    url: string,
    translations: Translations,
    assets: Record<string, string[]>,
    cache: Cache,
    res: ServerResponse,
    signal?: AbortSignal,
) {
    const files = [...assets[url]];
    while (files.length > 0)
    {
        const filelocation = files.pop()!;
        try
        {
            return getFILE({ absolute: filelocation, relative: url }, cache, res, signal);
        }
        catch { } // we try the next then
    }

    // we need to check translations 
    if (translations.map[url])
    {
        const lang = translations.map[url]
        if (lang)
        {
            return {
                mimeType: 'application/json',
                buffer: Buffer.from(JSON.stringify(translations.data[lang]))
            }
        }
    }

    throw new NotFoundError(`asset "${url}" not found`);
}
