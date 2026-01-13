import path from "node:path";
import fs from "node:fs";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information, LocalPackage, PackageNode, RootPackage } from "@papit/information";

export async function post(packageJSON: LocalPackage | RootPackage) {

    Arguments.set("remote", true);
    Arguments.set('descendants', true);

    const updateDependencies = new Map<string, string>();
    updateDependencies.set(packageJSON.name, packageJSON.version);
    const lockfilepath = path.join(Information.root.location, "temp-package-lock.json");
    const batches = Information.getBatches();

    for (const batch of batches)
    {        
        for (const node of batch)
        {
            const status = await runner(node, updateDependencies);
            if (status)
            {
                Terminal.write(Terminal.green(node.packageJSON.name), "version patch");
            }
            else 
            {
                Terminal.error(node.name, "version broke");
            }
        }
    }

    fs.renameSync(lockfilepath, path.join(Information.root.location, "package-lock.json"));
}


function runner(node: PackageNode, updateDependencies: Map<string, string>) {

    return new Promise<boolean>(async resolve => {

        // we upgrade remote version if they dont match 
        const remote = await node.remote();
        let changed = false;
        if (remote !== null && node.packageJSON.remoteVersion !== remote)
        {
            node.packageJSON.remoteVersion = remote;
            changed = true;
        }

        // we do a patch if we need 
        if (!(changed || node.packageJSON.version !== node.packageJSON.remoteVersion))
        {
            const match = node.packageJSON.version.match(/^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?<semver>.*)$/);
            if (match?.groups)
            {
                const { major, minor, patch, semver } = match.groups;
                node.packageJSON.version = `${major}.${minor}.${Number(patch) + 1}${semver}`;
            }
        }

        for (const [name, version] of updateDependencies)
        {
            if (node.packageJSON.dependencies?.[name]) node.packageJSON.dependencies[name] = version;
            if (node.packageJSON.devDependencies?.[name]) node.packageJSON.devDependencies[name] = version;
            if (node.packageJSON.peerDependencies?.[name]) node.packageJSON.peerDependencies[name] = version;
        }

        updateDependencies.set(node.packageJSON.name, node.packageJSON.version);

        let isSuccess = true;
        try 
        {
            fs.writeFileSync(path.join(node.location, "package.json"), JSON.stringify(node.packageJSON, null, 2), { encoding: "utf-8" });
        }
        catch (e)
        {
            isSuccess = false;
            
            if (Arguments.error)
            {
                console.log(e);
            }
        }
        finally 
        {
            resolve(isSuccess)
        }
    });
}