// graph.ts
import fs from "node:fs";
import path from "node:path";
import { Graph as BaseGraph, GraphNode } from "@papit/data-structure";
import type { LocalPackage, Package, RootPackage } from "./types";
import { PackageNode } from "./node";
import { Cache } from "./cache";
import { Arguments } from "@papit/arguments";

export class Graph {
    root!: PackageNode<RootPackage>;
    private graph: BaseGraph<PackageNode, string, string>;
    private _nodes = new Map<string, PackageNode<LocalPackage>>();

    get nodes() {
        // Filter root out for external API
        return Array.from(this._nodes.values()); //.filter(node => node.type !== "root");
    }

    get(name: string) { return this._nodes.get(name) as PackageNode<LocalPackage> }

    search(location: string, compare: "start" | "end" = "end") {
        if (compare === "end") return this.nodes.find(node => node.location.endsWith(location));
        return this.nodes.find(node => location.startsWith(node.location));
    }

    private scope = "";
    public ERROR = false;

    constructor() {
        this.graph = new BaseGraph<PackageNode, string, string>(false);
        const location = process.cwd();

        try
        {
            const leftovers = new Map<string, string[]>();
            const rootPATH = findWorkspaceRoot(location);
            const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
            this.scope = rootJSON.name.split("/").at(0);

            this.root = this.add(rootPATH, "root", leftovers, rootJSON);
            Cache.setup(this.root.location);

            fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" })
                .filter(loc => {
                    if (!loc.endsWith("package.json")) return false;
                    if (/[/\\]asset[/\\]/i.test(loc)) return false;
                    return true;
                })
                .forEach((localFilePath) => {
                    const location = path.dirname(path.join(rootPATH, "packages", localFilePath));
                    this.add(location, "local", leftovers);
                });

            // Process leftovers (dependencies that weren't found yet)
            leftovers.forEach((dependants, name) => {
                const node = this.get(name);
                if (!node) return;
                dependants.forEach(dep => {
                    const dnode = this.get(dep);
                    if (!dnode) return;
                    // Add edge in the graph
                    this.graph.addEdge(node.name, dnode.name, "dependencies");
                });
            });
        } catch (error)
        {
            console.error("Error initializing graph:", error);
            this.ERROR = true;
        }
    }

    add(location: string): PackageNode;
    add(location: string, type: "external" | "root" | "local", leftovers?: Map<string, string[]>): PackageNode;
    add(location: string, type: "external" | "root" | "local", leftovers?: Map<string, string[]>, packageJSON?: Package): PackageNode;
    add(location: string, type: "external" | "root" | "local" = "local", leftovers?: Map<string, string[]>, _packageJSON?: Package) {
        const packageJSON = _packageJSON ?? JSON.parse(fs.readFileSync(path.join(location, "package.json"), { encoding: "utf-8" }));

        if (packageJSON.papit?.skip) return;

        if (!this._nodes.has(packageJSON.name))
        {
            const node = new PackageNode(
                packageJSON,
                type,
                location,
            );
            this._nodes.set(packageJSON.name, node);
            // Add node to graph
            this.graph.addNode(node);
        }

        const node = this._nodes.get(packageJSON.name)!;
        const deparray = ["dependencies", "peerDependencies", "devDependencies"];

        for (const dependencyType of deparray)
        {
            for (const key in packageJSON[dependencyType])
            {
                if (!key.startsWith(this.scope)) continue;

                const existingNode = this._nodes.get(key);
                if (existingNode)
                {
                    // Add edge: dependency (key) → dependent (node)
                    this.graph.addEdge(key, node.name, dependencyType);
                } else if (leftovers)
                {
                    if (leftovers.has(key)) leftovers.get(key)?.push(node.name);
                    else leftovers.set(key, [node.name]);
                }
            }
        }

        return node;
    }

    // In your Graph class
    public getOrder(
        packages: PackageNode<LocalPackage>[],
        sortFilter: string[] = ["dependencies", "peerDependencies"],      // Used for topological sorting
        includeFilter: string[] = ["devDependencies"]   // Used for which nodes to include
    ): PackageNode[][] {
        // Get all nodes we want to include
        const allPackageIds = packages.map(p => p.name);
        const subgraph = this.graph.subgraph(allPackageIds);

        // Get sorted order based on sortFilter (production deps only)
        const order = subgraph.toposort(sortFilter);

        // Convert to batches (same as before)
        const batches: PackageNode[][] = [];
        const processed = new Set<string>();

        for (const id of order)
        {
            const node = this.get(id);
            if (node && !processed.has(id))
            {
                const ancestors = subgraph.ancestors(id, sortFilter);
                const allDepsProcessed = ancestors.every(ancestor => processed.has(ancestor.id));

                if (allDepsProcessed)
                {
                    const batch = order.filter(currentId => {
                        const currentNode = this.get(currentId);
                        if (!currentNode || processed.has(currentId)) return false;
                        const currentAncestors = subgraph.ancestors(currentId, sortFilter);
                        return currentAncestors.every(ancestor => processed.has(ancestor.id));
                    });

                    if (batch.length > 0)
                    {
                        batches.push(batch.map(id => this.get(id)!));
                        batch.forEach(id => processed.add(id));
                    }
                }
            }
        }

        // If we need to include devDeps that weren't in the sort order
        if (includeFilter?.includes("devDependencies"))
        {
            const allIncluded = new Set(batches.flatMap(b => b.map(n => n.name)));
            const missing = packages.filter(p => !allIncluded.has(p.name));
            if (missing.length > 0)
            {
                batches.push(missing);
            }
        }

        return batches;
    }

    public getDescendants(name: string, typeFilter?: string[]): PackageNode[] {
        const descendants = this.graph.descendants(name, typeFilter);
        return descendants.map(node => this.get(node.id)!);
    }

    public getAncestors(name: string, typeFilter?: string[]): PackageNode[] {
        const ancestors = this.graph.ancestors(name, typeFilter);
        return ancestors.map(node => this.get(node.id)!);
    }
}

// PackageGraph remains the same
export class PackageGraph {
    private static instance = new Graph();
    static initialize() { this.instance = new Graph() }
    static get(name: string) { return this.instance.get(name) }
    static add(location: string) { return this.instance.add(location) }
    static get root() { return this.instance.root }
    static get ERROR() { return this.instance.ERROR }
    static get nodes() { return this.instance.nodes }
    static get size() { return this.instance.nodes.length }
    static search(location: string, compare: "start" | "end" = "end") { return this.instance.search(location, compare) }
    static getOrder(packages: PackageNode<LocalPackage>[], typeFilter?: string[]) {
        return this.instance.getOrder(packages, typeFilter)
    }
    static getDescendants(name: string, typeFilter?: string[]) {
        return this.instance.getDescendants(name, typeFilter)
    }
    static getAncestors(name: string, typeFilter?: string[]) {
        return this.instance.getAncestors(name, typeFilter)
    }
}

// Helper functions remain the same...
function findWorkspaceRoot(startDir: string): string {
    if (process.env.npm_config_local_prefix && isRoot(process.env.npm_config_local_prefix)) return process.env.npm_config_local_prefix;

    let dir = startDir;
    while (dir !== path.dirname(dir))
    {
        if (isRoot(dir)) return dir;
        dir = path.dirname(dir);
    }
    return startDir;
}

function isRoot(dir: string) {
    if (!fs.existsSync(path.join(dir, "package.json"))) return false;
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
    return !!pkg.workspaces;
}