import fs from "node:fs";
import path from "node:path";
import { deepMergeTwo } from "@papit/deep-merge";

export type Translation = {
    meta: {
        region: string;
        language: string;
    };
    [key: string]: unknown;
}

export type Translations = {
    data: Record<string, Translation>;
    map: Record<string, string>;
}

export function extractTranslation(location: string, file: string, translations: Translations) {
    const json = JSON.parse(fs.readFileSync(file, { encoding: "utf-8" })) as Translation
    const lang = json?.meta?.language ?? path.basename(file, '.json');

    if (!translations.data[lang]) translations.data[lang] = { meta: json.meta }
    translations.data[lang] = deepMergeTwo(translations.data[lang], json, ["meta"]);

    // register ALL url variations for this file → language
    const relativeURL = path.relative(location, file);
    const segments = relativeURL.split(path.sep);

    while (segments.length > 0) 
    {
        const url = '/' + segments.join('/');
        translations.map[url] = lang;
        segments.shift()
    }
}

export function isTranslation(filepath: string) {
    if (!filepath.endsWith('.json')) return false;

    const dirname = path.basename(path.dirname(filepath));
    return /^(transl|locale|i18)/i.test(dirname);
}