import path from "node:path";
import { ServerResponse } from "node:http";

import { type Translations } from "./translation";
import { NotFoundError } from "components/errors";
import { getFILE } from "components/file/get";
import { Cache } from "components/file/cache";

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
        const joined = path.join(path.sep + segments.join(path.sep));
        if (!assets[joined]) assets[joined] = [];
        assets[joined].push(file);
        segments.shift();
    }
}

export async function streamAsset(
    url: string,
    translations: Translations,
    assets: Record<string, string[]>,
    cache: Cache,
    res: ServerResponse,
    signal?: AbortSignal,
) {
    const normalized = path.normalize(url);

    // we need to check translations 
    if (translations.map[normalized])
    {
        const lang = translations.map[normalized]
        if (lang)
        {
            return {
                mimeType: 'application/json',
                buffer: Buffer.from(JSON.stringify(translations.data[lang]))
            }
        }
    }

    const files = [...assets[normalized]];
    while (files.length > 0)
    {
        const filelocation = files.pop()!;
        try
        {
            return getFILE({ absolute: path.normalize(filelocation), relative: normalized }, cache, res, signal);
        }
        catch { } // we try the next then
    }


    throw new NotFoundError(`asset "${normalized}" not found`);
}
