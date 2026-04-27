import path from "node:path";
import { Arguments } from "@papit/arguments";
import { PriorityQueue } from "@papit/data-structure";

import { PackageGraph } from "./graph";
import { PackageNode } from "./node";
import type { LocalPackage, RootPackage } from "./types";

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
        return path.normalize(this._local)
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

    static get packageName() { return this.package.name }
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

    static getPriorityBatches(args = Arguments.instance) {
        const batches = this.getBatches(args);
        const prioQueue = new PriorityQueue<PackageNode>();
        const prioSet = new Set<string>();

        for (const batch of batches)
        {
            for (const node of batch)
            {
                if (node.packageJSON.papit.priority === undefined) continue;
                if (this.package.name === node.name) continue;
                prioQueue.enqueue(node, node.packageJSON.papit.priority);
                prioSet.add(node.name);
            }
        }

        const ordered: PackageNode[][] = [Array.from(prioQueue)];
        for (const batch of batches)
        {
            const filtered = batch.filter(n => !prioSet.has(n.name));
            if (filtered.length > 0) ordered.push(filtered);
        }

        return ordered; // first array is priority, rest are batches in order
    }
}