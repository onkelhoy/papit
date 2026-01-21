import { PackageGraph } from "./graph";
import { PackageNode } from "./node";
import { Cache } from "./cache";

export class Information {
    private static _package: PackageNode | undefined;
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

    static get package() {
        if (!this._package)
        {
            this._package = PackageGraph.nodes
                .filter(node => this.local.toLowerCase().startsWith(node.location.toLowerCase()))
                .sort((a, b) => b.location.length - a.location.length)
                .at(0)!;
        }

        return this._package;
    }

    static get name() { return this.package.name }
    static get location() { return this.package.location }
    static get sourceFolder() { return this.package.sourceFolder }
    static get outFolder() { return this.package.outFolder }
}