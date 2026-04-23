import path from "node:path";
import fs from "node:fs";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information } from "@papit/information";

import { extractAssets, getAssetFolders, Translations } from "components/asset";
import { close as httpExit, start as httpStart } from "components/http";
import type { Importmap } from "components/importmap/types";
import { extractImportmap } from "components/importmap/import-map";
import { getPackageLocationFromImportMeta } from "components/http/url";

export * from "components/http"

export async function setup() {

    const serverPackageLocation = getPackageLocationFromImportMeta(import.meta.url);

    if (serverPackageLocation == null)
    {
        Terminal.error("script location of @papit/server is missing");
        process.exit(1);
    }

    let packageJSON = Information.package.packageJSON;

    if (!packageJSON)
    {
        Terminal.error("location is not a package, missing package.json");
        process.exit(1);
    }

    const translations: Translations = {
        data: {},
        map: {},
    };
    const assets: Record<string, string[]> = {};
    const assetFolders = getAssetFolders();

    await extractAssets(
        serverPackageLocation,
        translations,
        assets,
        assetFolders,
    );

    const importmap: Importmap = {
        imports: {}
    }

    const themes = new Map<string, string>();

    let importmapFolder: string | null = null;

    if (Information.root.location === Information.package.location)
        importmapFolder = path.join(Information.root.location, "node_modules");
    else
        importmapFolder = path.join(Information.package.location, Arguments.string("import-map") ?? ".temp/dependencies");

    let createdImportMapFolder = false;
    if (importmapFolder && !fs.existsSync(importmapFolder))
    {
        createdImportMapFolder = true;
        fs.mkdirSync(importmapFolder, { recursive: true });
    }

    if (Information.package.location !== Information.root.location)
    {
        Arguments.set("ancestors", true);
    }

    const batches = Information.getBatches();

    for (const batch of batches)
    {
        for (const node of batch) 
        {
            if (node.packageJSON.papit.type === "theme")
            {
                const output = node.entrypoints.entries.theme?.import?.output ?? node.entrypoints.entries.bundle?.import?.output;
                if (output)
                {
                    themes.set(node.name, output);
                }
                continue;
            }

            if (importmapFolder)
            {
                extractImportmap(node, importmap, importmapFolder);
            }

            if (!Arguments.has("include-node") && node.packageJSON.papit.type === "node") continue;

            await extractAssets(
                node.location,
                translations,
                assets,
                assetFolders,
            );

        }
    }

    const shutdown = () => {
        if (importmapFolder && createdImportMapFolder && !Arguments.has("import-map"))
        {
            fs.rmSync(path.join(Information.package.location, ".temp"), { force: true, recursive: true });
        }

        console.log(); // spacing for Ctrl+C
        httpExit();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);   // Ctrl+C
    process.on("SIGTERM", shutdown);  // kill <pid>, Docker stop
    process.on("SIGHUP", shutdown);   // terminal closed

    await httpStart(
        serverPackageLocation,
        translations,
        assets,
        importmap,
        themes,
    );
};

