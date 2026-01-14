import path from "node:path";
import fs from "node:fs";
import { Arguments, DependencyBatch, getDependencyBloodline, getDependencyOrder, getJSON, getPathInfo, LocalPackage, Lockfile, Terminal } from "@papit/util"

import { getAssetFolders, handleAsset, Translation } from "./components/asset";
import { close as httpExit, start as httpStart } from "./components/http";
import { Importmap } from "./components/importmap/types";
import { extractImportmap } from "./components/importmap/import-map";

export * from "./components/http"

export async function setup() {
    const info = getPathInfo(
        typeof Arguments.args.flags.location === "string" ? Arguments.args.flags.location : undefined,
        import.meta.url
    );

    if (info.script == null)
    {
        Terminal.error("script location of @papit/server is missing");
        process.exit(1);
    }

    const lockfile = getJSON<Lockfile>(path.join(info.package, "package-lock.json"));
    let packageJSON = getJSON<LocalPackage>(path.join(info.package, "package.json"));
    if (!packageJSON)
    {
        packageJSON = getJSON<LocalPackage>(path.join(info.root, "package.json"));
    }

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
        const assetLocation = path.join(info.script, asset);
        await handleAsset(info.script, assetLocation, translations, assets, assetFolders);
    }

    const importmap: Importmap = {
        imports: {}
    }

    let importmapFolder: string | null = null;
    if (!Arguments.has("bundle")) 
    {
        if (info.root === info.local)
            importmapFolder = path.join(info.root, "node_modules");
        else
            importmapFolder = path.join(info.local, Arguments.string("import-map") ?? ".temp/dependencies");
    }
    // !Arguments.has("bundle") ? path.join(info.local, Arguments.string("import-map") ?? ".temp/dependencies") : null;
    let createdImportMapFolder = false;
    if (importmapFolder && !fs.existsSync(importmapFolder))
    {
        createdImportMapFolder = true;
        fs.mkdirSync(importmapFolder, { recursive: true });
    }

    async function runBatch(batch: DependencyBatch[]) {
        for (const b of batch) 
        {
            if (!b.location) continue;
            const _pkgJSON = getJSON<LocalPackage>(path.join(b.location, "package.json"));
            if (!_pkgJSON) continue;

            if (importmapFolder)
            {
                extractImportmap(info, _pkgJSON, lockfile, b.location, importmap, importmapFolder);
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
            fs.rmSync(path.join(info.local, ".temp"), { force: true, recursive: true });
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

