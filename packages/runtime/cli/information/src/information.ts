import { PackageGraph } from "./graph";

export class Information {
    static get local() { return process.cwd() }
    static get root() { return PackageGraph.root.location }

    static get package() {
        const local = this.local;
        return PackageGraph.nodes
            .filter(node => local.startsWith(node.location))
            .sort((a, b) => b.location.length - a.location.length)
            .at(0)?.location;
    }

    static get scope() { return PackageGraph.root.name.split("/").at(0)! }
}