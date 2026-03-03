import path from "node:path";
import fs from "node:fs";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information } from "@papit/information";
import { build } from "@papit/build";

import { getAssetFolders, handleAsset,type Translation } from "./components/asset";
import { close as httpExit, start as httpStart, update as socketUpdate } from "./components/http";
import type { Importmap } from "./components/importmap/types";
import { extractImportmap } from "./components/importmap/import-map";
import { getPackageLocationFromImportMeta } from "./components/http/url";

export * from "./components/http"

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

    const translations: Record<string, Translation> = {};
    const assets: Record<string, string[]> = {};
    const assetFolders = getAssetFolders();

    // we start by loading assets from dev-server (so we allow for overrides)
    for (const asset of assetFolders)
    {
        const assetLocation = path.join(serverPackageLocation, asset);
        await handleAsset(serverPackageLocation, assetLocation, translations, assets, assetFolders);
    }

    const importmap: Importmap = {
        imports: {}
    }

    let importmapFolder: string | null = null;
    if (!Arguments.has("bundle")) 
    {
        if (Information.root.location === Information.package.location)
            importmapFolder = path.join(Information.root.location, "node_modules");
        else
            importmapFolder = path.join(Information.package.location, Arguments.string("import-map") ?? ".temp/dependencies");
    }
    // !Arguments.has("bundle") ? path.join(Information.package.location, Arguments.string("import-map") ?? ".temp/dependencies") : null;
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
            if (importmapFolder)
            {
                extractImportmap(node, importmap, importmapFolder);
            }

            if (!Arguments.has("include-node") && node.packageJSON.papit.type === "node") continue;

            for (const asset of assetFolders)
            {
                const assetLocation = path.join(node.location, asset);
                await handleAsset(node.location, assetLocation, translations, assets, assetFolders);
            }
        }
    }

    if (!Arguments.has("prod")) Arguments.set("live", true);
    const buildOutput = await build(Arguments.instance, (node, info) => {
        if (info.type === "rebuild")
        {
            Terminal.write(Terminal.blue("package change"), node.name)
            socketUpdate(node.location, info.result.outputFiles?.at(0)?.text ?? "");
        }
    });

    const shutdown = () => {
        if (importmapFolder && createdImportMapFolder && !Arguments.has("import-map"))
        {
            fs.rmSync(path.join(Information.package.location, ".temp"), { force: true, recursive: true });
        }

        buildOutput.forEach(output => output.dispose());

        console.log(); // spacing for Ctrl+C
        httpExit();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);   // Ctrl+C
    process.on("SIGTERM", shutdown);  // kill <pid>, Docker stop
    process.on("SIGHUP", shutdown);   // terminal closed

    if (!Arguments.has("serve")) Arguments.set("live", true);
    await httpStart(serverPackageLocation, translations, assets, importmap);
};

(async function () {
    if (Arguments.isCLI && !!process.env._?.endsWith("papit-server"))
    {
        setup();
    }
}())

