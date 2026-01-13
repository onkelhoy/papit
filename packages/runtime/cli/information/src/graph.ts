import fs from "node:fs";
import path from "node:path";
import { LocalPackage, Package, RootPackage } from "./types";
import { PackageNode } from "./node";
import { Cache } from "./cache";

export class Graph {
    root!: PackageNode<RootPackage>;
    private _nodes = new Map<string, PackageNode<LocalPackage>>();

    get nodes() { return Array.from(this._nodes.values()) }
    get(name: string) { return this._nodes.get(name) as PackageNode<LocalPackage> }
    search(location: string, compare: "start"|"end" = "end") 
    { 
        if (compare === "end") return this.nodes.find(node => node.location.endsWith(location));
        return this.nodes.find(node => location.startsWith(node.location));
    }

    private scope = "";

    constructor() {
        const location = process.cwd();

        const leftovers = new Map<string, string[]>();
        const rootPATH = findWorkspaceRoot(location);
        const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
        this.scope = rootJSON.name.split("/").at(0);

        this.root = this.add(rootPATH, "root", leftovers, rootJSON);
        Cache.setup(this.root.location);

        fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" })
            .filter(loc => {
                if (!loc.endsWith("package.json")) return false;
                if (/\/asset\//i.test(loc)) return false;

                return true;
            })
            .forEach((localFilePath, index, array) => {
                const location = path.dirname(path.join(rootPATH, "packages", localFilePath));
                this.add(
                    location,
                    "local",
                    leftovers,
                );
            });

        leftovers.forEach((dependants, name) => {
            const node = this.get(name);
            if (!node) return;
            dependants.forEach(dep => {
                const dnode = this.get(dep);
                if (!dnode) return;
                node.children.push(dnode);
                dnode.parents.push(node);
            })
        });
    }

    add(location: string): PackageNode;
    add(location: string, type: "external" | "root" | "local", leftovers?: Map<string, string[]>): PackageNode;
    add(location: string, type: "external" | "root" | "local", leftovers?: Map<string, string[]>, packageJSON?: Package): PackageNode;
    add(location: string, type: "external" | "root" | "local" = "local", leftovers?: Map<string, string[]>, _packageJSON?: Package) {
        const packageJSON = _packageJSON ?? JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));

        if (!this._nodes.has(packageJSON.name))
        {
            const node = new PackageNode(
                packageJSON,
                type,
                location,
            );

            this._nodes.set(packageJSON.name, node);
        }

        const node = this._nodes.get(packageJSON.name)!;

        for (const dependencyType of ["dependencies", "devDependencies", "peerDependencies"] as const)
        {
            for (const key in packageJSON[dependencyType])
            {
                if (!key.startsWith(this.scope)) continue;

                const existingNode = this._nodes.get(key); // ?? this.createNode(scope, );
                if (existingNode)
                {
                    node.parents.push(existingNode);
                    existingNode.children.push(node as PackageNode<LocalPackage>);
                }
                else if (leftovers)
                {
                    if (leftovers.has(key)) leftovers.get(key)?.push(node.name);
                    else leftovers.set(key, [node.name]);
                }
            }
        }

        return node;
    }

    public getOrder(packages: PackageNode<LocalPackage>[]) {
        const map = new Map<string, string[]>();
        const batches: PackageNode[][] = [];

        for (const node of packages)
        {
            if (node.name === this.root.name) continue;
            map.set(node.name, node.ancestors.map(n => n.name));
        }

        while (map.size > 0)
        {
            const batch: PackageNode[] = [];

            const sorted = Array.from(map.keys()).map(name => {
                const deps = map.get(name)!;
                return { name, count: deps.filter(dep => map.has(dep)).length };
            }).sort((a, b) => a.count - b.count);

            let current: number | undefined;
            for (const item of sorted)
            {
                if (current === undefined) current = item.count;
                if (current !== item.count) break;

                map.delete(item.name);
                batch.push(this.get(item.name)!);
            }

            batches.push(batch);
        }

        return batches;
    }
}

export class PackageGraph {
    private static instance = new Graph();
    static get(name: string) { return this.instance.get(name) }
    static add(location: string) { return this.instance.add(location) }
    static get root() { return this.instance.root }
    static get nodes() { return this.instance.nodes }
    static get size() { return this.instance.nodes.length }
    static search(location: string, compare: "start"|"end" = "end") { return this.instance.search(location, compare) }
    static getOrder(packages: PackageNode<LocalPackage>[]) { return this.instance.getOrder(packages) }
}

// helper functions 
function findWorkspaceRoot(startDir: string): string {
    if (process.env.npm_config_local_prefix && isRoot(process.env.npm_config_local_prefix)) return process.env.npm_config_local_prefix;

    let dir = startDir;
    while (dir !== path.dirname(dir))
    { // stop at filesystem root
        if (isRoot(dir)) return dir; // found monorepo root

        dir = path.dirname(dir);
    }
    return startDir; // fallback
}

function isRoot(dir: string) {
    if (!fs.existsSync(path.join(dir, "package.json"))) return false;

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
    return !!pkg.workspaces;
}