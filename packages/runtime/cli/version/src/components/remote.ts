import { Information } from "@papit/information";

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
            }
        }
    }
}