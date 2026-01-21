import { Information, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

(async function ()  {
    if (!Arguments.isCLI) return;

    if (Arguments.has("bloodline")) console.log('bloodline')
    if (Arguments.has("ancestors")) console.log('ancestors')
    if (Arguments.has("descendants")) console.log('descendants')

    if (Arguments.has("all") || Information.package.name === Information.root.name)
    {
                      
    }
})