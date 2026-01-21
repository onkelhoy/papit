import { Information, PackageNode, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

(async function ()  {
    if (!Arguments.isCLI && !Arguments.has("run")) return;

    if (Arguments.has("bloodline")) console.log('bloodline')
    if (Arguments.has("ancestors")) console.log('ancestors')
    if (Arguments.has("descendants")) console.log('descendants')

    let batches: PackageNode[][];
    if (Arguments.has("all") || Information.package.name === Information.root.name)
    {
        batches = PackageGraph.order(PackageGraph.nodes)
    }
    else if (Arguments.has("bloodline"))
    {
        batches = PackageGraph.order(Information.package.ancestors.concat(Information.package, ...Information.package.descendants));
    }
    else if (Arguments.has("descendants"))
    {
        batches = PackageGraph.order(Information.package.descendants.concat(Information.package));
    }
    else if (Arguments.has("ancestors"))
    {
        batches = PackageGraph.order(Information.package.ancestors.concat(Information.package));
    }
    else 
    {
        // individual 
        batches = [[Information.package]];
    }


    console.log(batches.map(b => b.map(n => n.name)));
}())