import path from "node:path";
import fs from "node:fs";
import { Information } from "@papit/information";
import { Arguments } from "@papit/arguments";

export async function pre() {

    const remote = await Information.package.remote() ?? Information.package.packageJSON.remoteVersion;
    if (remote && remote !== Information.package.packageJSON.version)
    {
        if (!Arguments.has("force")) throw new Error(`${Information.package.name}@${Information.package.packageJSON.version} is already ahead of remote (${remote}), use --force to override`);
    }

    const PKG_LOCK = path.join(Information.root.location, "package-lock.json"); // trick to not cause npm to spat out npm installs 
    if (!fs.existsSync(PKG_LOCK)) return;

    fs.renameSync(PKG_LOCK, path.join(Information.root.location, "temp-package-lock.json"));
}