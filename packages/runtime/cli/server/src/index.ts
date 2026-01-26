import path from "node:path";
import fs from "node:fs";
// import { Arguments, DependencyBatch, getDependencyBloodline, getDependencyOrder, getJSON, getPathInfo, LocalPackage, Lockfile, Terminal } from "@papit/util"
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information } from "@papit/information";

import { getAssetFolders, handleAsset, Translation } from "./components/asset";
import { close as httpExit, start as httpStart } from "./components/http";
import { Importmap } from "./components/importmap/types";
import { extractImportmap } from "./components/importmap/import-map";
// import { getMeta } from "@papit/build";

export * from "./components/http"

export async function setup() {

    const serverPackageLocation = Information.getNearestPackageLocation(import.meta.url);

    if (serverPackageLocation == null)
    {
        Terminal.error("script location of @papit/server is missing");
        process.exit(1);
    }

    let packageJSON = Information.package.packageJSON;
    // let meta: Awaited<ReturnType<typeof getMeta>>;
    // if (!packageJSON)
    // {
    //     packageJSON = getJSON<LocalPackage>(path.join(Information.root.location, "package.json"));
    // }
    // else 
    // {
    //     meta = await getMeta(Arguments.has("prod") ? "prod" : "dev", info, packageJSON);
    // }

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

    const runBatch = async (batch: DependencyBatch[]) => {
        for (const b of batch) 
        {
            if (!b.location) continue;
            const _pkgJSON = getJSON<LocalPackage>(path.join(b.location, "package.json"));
            if (!_pkgJSON) continue;

            if (importmapFolder)
            {
                extractImportmap(info, _pkgJSON, lockfile, b.location, importmap, importmapFolder, packageJSON, meta);
            }

            if (!Arguments.args.flags["include-node"] && _pkgJSON?.papit.type === "node") continue;

            for (const asset of assetFolders)
            {
                const assetLocation = path.join(b.location, asset);
                await handleAsset(b.location, assetLocation, translations, assets, assetFolders);
            }
        }
    }

    if (packageJSON.workspaces)
    {
        await getDependencyOrder(runBatch, { info, silent: true });
    }
    else
    {
        // NOTE: order is reversed -> last is current package, so looking for asset should always start at the end of array of "assets"
        await getDependencyBloodline(
            packageJSON.name,
            runBatch,
            { info, type: "ancestors", silent: true }
        );
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

    if (!Arguments.has("serve")) Arguments.args.flags.live = true;
    await httpStart(info, translations, assets, packageJSON, importmap);
};

(async function () {
    if (process.env.npm_lifecycle_event === "npx")
    {
        setup();
    }
}())

