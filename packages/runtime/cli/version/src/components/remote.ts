import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

export async function remote() {

    const batches = Information.getBatches();
    for (const batch of batches)
    {
        for (const node of batch)
        {
            const remote = await node.remote() ?? "";

            if (remote !== node.packageJSON.remoteVersion)
            {
                node.packageJSON.remoteVersion = remote;
                node.savePackageJSON();
                Terminal.write(Terminal.yellow("●"), Terminal.dim(node.name), Terminal.yellow("synched"));
            }
            else 
            {
                Terminal.write(Terminal.blue("●"), Terminal.dim(node.name), Terminal.blue("skipped"));
            }
        }
    }
}