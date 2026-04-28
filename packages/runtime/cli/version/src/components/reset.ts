import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

export async function reset() {
    const batches = Information.getPriorityBatches();
    const updateDependencies = new Map<string, string>();

    for (const batch of batches)
    {
        for (const node of batch)
        {
            let changed = false;
            const remote = await node.remote() ?? node.packageJSON.remoteVersion;
            if (!remote)
            {
                if (node.packageJSON.version !== "0.0.1")
                {
                    node.packageJSON.version = "0.0.1";
                    changed = true;
                }
            }
            else if (remote !== node.packageJSON.version)
            {
                node.packageJSON.version = remote;
                node.packageJSON.remoteVersion = remote;
                changed = true;
            }

            for (const [name, version] of updateDependencies)
            {
                if (node.packageJSON.dependencies?.[name] && node.packageJSON.dependencies[name] !== version)
                {
                    node.packageJSON.dependencies[name] = version;
                    changed = true;
                }
                if (node.packageJSON.devDependencies?.[name] && node.packageJSON.devDependencies[name] !== version)
                {
                    node.packageJSON.devDependencies[name] = version;
                    changed = true;
                }
                if (node.packageJSON.peerDependencies?.[name] && node.packageJSON.peerDependencies[name] !== version)
                {
                    node.packageJSON.peerDependencies[name] = version;
                    changed = true;
                }
            }

            updateDependencies.set(node.packageJSON.name, node.packageJSON.version);

            if (changed)
            {
                Terminal.write(Terminal.yellow("●"), Terminal.dim(node.name), Terminal.yellow("reset"));
                node.savePackageJSON();
            }
            else 
            {
                Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
            }
        }
    }
}