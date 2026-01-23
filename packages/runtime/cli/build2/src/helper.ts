import { Information, PackageNode, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";

// helper function 
export function getBatches(args = Arguments.instance) {
    let batches: PackageNode[][];
    if (!args.has("individual") && (args.has("all") || Information.package.name === Information.root.name))
    {
        batches = PackageGraph.getOrder(PackageGraph.nodes)
    }
    else if (!args.has("individual") && args.has("bloodline"))
    {
        batches = PackageGraph.getOrder(Information.package.ancestors.concat(Information.package, ...Information.package.descendants));
    }
    else if (!args.has("individual") && args.has("descendants"))
    {
        batches = PackageGraph.getOrder(Information.package.descendants.concat(Information.package));
    }
    else if (!args.has("individual") && args.has("ancestors"))
    {
        batches = PackageGraph.getOrder(Information.package.ancestors.concat(Information.package));
    }
    else 
    {
        // individual 
        batches = [[Information.package]];
    }

    return batches;
}