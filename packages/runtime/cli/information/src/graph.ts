import fs from "node:fs";
import path from "node:path";
import { LocalPackage, RootPackage } from "./types";
import { Node } from "./node";

export class Graph {
    root!: Node;
    private _nodes = new Map<string, Node>();

    get nodes() { return Array.from(this._nodes.values()) }
    get(name: string) { return this._nodes.get(name) }

    constructor() {
        const location = process.cwd();

        const leftovers = new Map<string, string[]>();
        const rootPATH = findWorkspaceRoot(location);
        const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
        const scope = rootJSON.name.split("/").at(0);
        this.root = this.createNode(scope, rootJSON, rootPATH, "root", leftovers);

        fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" })
            .filter(loc => {
                if (!loc.endsWith("package.json")) return false;
                if (/\/asset\//i.test(loc)) return false;

                return true;
            })
            .forEach((localFilePath, index, array) => {
                const location = path.join(rootPATH, "packages", localFilePath);
                const packageJSON = JSON.parse(fs.readFileSync(location, { encoding: "utf-8" }));
                const dirname = path.dirname(location);
                this.createNode(
                    scope,
                    packageJSON,
                    dirname,
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

    private createNode(
        scope: string,
        packageJSON: LocalPackage | RootPackage,
        location: string,
        type: "external" | "root" | "local",
        leftovers: Map<string, string[]>,
    ) {
        if (!this._nodes.has(packageJSON.name))
        {
            const node = new Node(
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
                if (!key.startsWith(scope)) continue;

                const existingNode = this._nodes.get(key); // ?? this.createNode(scope, );
                if (existingNode)
                {
                    node.parents.push(existingNode);
                    existingNode.children.push(node);
                }
                else 
                {
                    if (leftovers.has(key)) leftovers.get(key)?.push(node.name);
                    else leftovers.set(key, [node.name]);
                }
            }
        }

        return node;
    }
}

export class PackageGraph {
    private static instance = new Graph();
    static get(name: string) {
        return this.instance.get(name);
    }
    static get root() { return this.instance.root }
    static get nodes() { return this.instance.nodes }
    static get size() { return this.instance.nodes.length }
    /** returns the current node based on process.cwk */
    // static get current() {
    //     const local = 
    //     return this.instance.nodes.find(node => {

    //     })
    // }
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