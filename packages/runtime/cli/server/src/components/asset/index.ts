import path from "node:path";
import fs from "node:fs";
import { extractTranslation, isTranslation, type Translations } from "./translation";
import { handleAsset } from "./asset";

// exports
export * from "./asset";
export * from "./helper";
export * from "./translation";

const SKIP = new Set(['node_modules', '.git', '.temp', 'lib', 'dist', 'src', 'explorer-icons']);


export async function extractAssets(
    location: string,
    translations: Translations,
    assets: Record<string, string[]>,
    assetFolders: string[],
) {
    const files = crawl(location, (name, filepath, isDir) => {
        if (SKIP.has(name)) return false;

        if (!isDir)
        {
            if (path.dirname(filepath) === location) return false;

            const segments = filepath.split(path.sep);
            if (!assetFolders.some(name => segments.includes(name))) return false;
        }

        return true;
    });

    for (const file of files)
    {
        if (isTranslation(file)) 
        {
            extractTranslation(location, file, translations);
        }
        else 
        {
            handleAsset(location, file, assets);
        }
    }
}

function crawl(
    location: string,
    filter?: (name: string, filepath: string, isDir: boolean) => boolean,
    deep = 0
): string[] {
    if (!fs.existsSync(location) || deep > 10) return []

    const results: string[] = []
    const entries = fs.readdirSync(location)

    for (const name of entries)
    {
        const url = path.join(location, name)
        const stat = fs.statSync(url)
        const isDir = stat.isDirectory()

        if (filter && !filter(name, url, isDir)) continue

        if (isDir)
        {
            results.push(...crawl(url, filter, deep + 1))
        } else
        {
            results.push(url)
        }
    }

    return results
}