import path from "node:path";
import fs from "node:fs";
import { ServerResponse } from "node:http";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

import { Translation, Translations } from "./types";
import { deepMerge } from "./util";
import { NotFoundError } from "../errors";
import { getFILE } from "../file/get";
import { Cache } from "../file/cache";

async function extractTranslation(folder: string, translations: Translations) {
    const files = fs
        .readdirSync(folder)
        .map(name => path.join(folder, name))
        .filter(file => fs.statSync(file).isFile() && file.endsWith(".json"));

    for (const file of files)
    {
        const json = JSON.parse(fs.readFileSync(file, { encoding: "utf-8" })) as Translation;
        
        if (!json) continue;

        if (!translations[json.meta.language]) translations[json.meta.language] = { meta: json.meta };
        translations[json.meta.language] = deepMerge(translations[json.meta.language], json, ["meta"]);
    }
}

export function getAssetFolders() {
    const folders = ["asset", "assets", "public"];

    if (Arguments.has("asset"))
    {
        const asset = Arguments.get("asset");
        folders.push(...asset);
    }
    return folders;
}

export async function handleAsset(
    root: string,
    location: string,
    translations: Record<string, Translation>,
    assets: Record<string, string[]>,
    folders: string[], // [assets|public|files]
    deep = 0,
) {
    if (!fs.existsSync(location)) return;

    // files and folders
    const FFs = fs.readdirSync(location); // .filter(name => fs.statSync(path.join(location, name)).isDirectory());

    for (const name of FFs) 
    {
        const url = path.join(location, name);
        const stat = fs.statSync(url);

        if (stat.isFile())
        {
            const relativeURL = path.relative(root, url);
            const absoluteURL = '/' + relativeURL;
            if (!assets[absoluteURL]) assets[absoluteURL] = [];
            assets[absoluteURL].push(url);

            const segments = relativeURL.split(path.sep);
            // Remove first segment if it's an asset folder
            if (folders.includes(segments[0]))
            {
                segments.shift();
                const relativeURL = '/' + segments.join('/');

                if (!assets[relativeURL]) assets[relativeURL] = [];
                assets[relativeURL].push(url);
            }
        }

        if (stat.isDirectory())
        {
            const lowerName = name.toLowerCase();
            if (lowerName.startsWith("translation"))
            {
                await extractTranslation(url, translations);
                return;
            }

            if (deep < 10)
            {
                await handleAsset(root, url, translations, assets, folders, deep + 1);
            }
            else if (Arguments.warning)
            {
                Terminal.warn("max asset depth reached", url);
            }
        }
    }
}


export async function streamAsset(
    url: string,
    translations: Record<string, Translation>,
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
    // if (translations[url])

    throw new NotFoundError(`asset "${url}" not found`);
}