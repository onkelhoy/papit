import { Arguments } from "@papit/arguments";

import { PackageGraph } from "./graph";
import { PackageNode } from "./node";
import { LocalPackage, RootPackage } from "./types";

export class Information {
    private static _package: PackageNode<LocalPackage | RootPackage> | undefined;
    private static _local: string | undefined;
    private static _scope: string | undefined;

    static get scope() {
        if (!this._scope) this._scope = this.root.name.split("/").at(0)!;
        return this._scope;
    }
    static get local() {
        if (!this._local) this._local = process.env.PWD ?? process.cwd();
        return this._local;
    }
    static get root() { return PackageGraph.root }

    static get package(): PackageNode<LocalPackage> {
        if (!this._package)
        {
            this._package = PackageGraph.nodes
                .filter(node => this.local.toLowerCase().startsWith(node.location.toLowerCase()))
                .sort((a, b) => b.location.length - a.location.length)
                .at(0)!;
        }

        return this._package as PackageNode<LocalPackage>;
    }

    static get name() { return this.package.name }
    static get location() { return this.package.location }
    static get sourceFolder() { return this.package.sourceFolder }
    static get outFolder() { return this.package.outFolder }

    static getBatches(args = Arguments.instance) {
        if (!args.has("individual") && (args.has("all") || Information.package.name === Information.root.name))
        {
            return PackageGraph.getOrder(PackageGraph.nodes)
        }

        if (!args.has("individual") && args.has("bloodline"))
        {
            return PackageGraph.getOrder(Information.package.ancestors.concat(Information.package, ...Information.package.descendants));
        }

        if (!args.has("individual") && args.has("descendants"))
        {
            return PackageGraph.getOrder(Information.package.descendants.concat(Information.package));
        }

        if (!args.has("individual") && args.has("ancestors"))
        {
            return PackageGraph.getOrder(Information.package.ancestors.concat(Information.package));
        }

        // individual 
        return [[Information.package]];
    }
}