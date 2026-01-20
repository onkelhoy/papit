import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot } from "./url";
import { LocalPackage, RootPackage } from "./types";
import { Remote } from "./remote";
import { Arguments, Loglevel } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import ts from "typescript";
// import { deepMerge } from "@papit/deep-merge";

type DepedencyType = "dependencies" | "devDependencies" | "peerDependencies";

export class Dependency {
    root!: Node;
    private nodes = new Map<string, Node>();

    get(name: string) {
        return this.nodes.get(name);
    }

    constructor(location: string = process.cwd(), entrypoints: string[] = []) {
        let close: Function | undefined;
        let update: ((text: string) => void) | undefined;
        if (Loglevel.info)
        {
            const loading = Terminal.loading("setting up dependency-graph");
            close = loading.close;
            update = loading.update
        }
        const session = Terminal.createSession();

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
                if (update) update(`setting up dependency-graph (${index + 1} / ${array.length})`);
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

        Terminal.clearSession(session);
        if (close) close();

        Remote.init(scope, this.nodes.size);
    }

    private createNode(
        scope: string,
        packageJSON: LocalPackage | RootPackage,
        location: string,
        type: "external" | "root" | "local",
        leftovers: Map<string, string[]>,
    ) {
        if (!this.nodes.has(packageJSON.name))
        {
            const node = new Node(
                packageJSON,
                type,
                location,
            );

            this.nodes.set(packageJSON.name, node);
        }

        const node = this.nodes.get(packageJSON.name)!;

        // if (leftovers.has(packageJSON.name))
        // {
        //     // should we address this one?
        //     leftovers.delete(packageJSON.name);
        // }

        for (const dependencyType of ["dependencies", "devDependencies", "peerDependencies"] as const)
        {
            for (const key in packageJSON[dependencyType])
            {
                if (!key.startsWith(scope)) continue;

                const existingNode = this.nodes.get(key); // ?? this.createNode(scope, );
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

    // private appendNode(
    //     node: Node,
    //     dependency: string,
    //     type: DepedencyType,
    //     leftovers: Map<string, [LocalPackage | RootPackage, DepedencyType]>,
    // ) {
    //     const stored = this.nodes.get(dependency);
    //     if (stored)
    //     {
    //         console.log('it happened', node.name, stored.name)
    //         node.parents.push({ node: stored, type });
    //         stored.children.push(node);

    //         leftovers.delete(dependency);
    //     }
    //     else 
    //     {
    //         leftovers.set(dependency, [node.packageJSON, type]);
    //     }
    // }
}


class Node {
    parents: Node[] = [];
    children: Node[] = [];

    constructor(
        private _packageJSON: LocalPackage | RootPackage,
        private _type: "external" | "root" | "local",
        private _location: string,
        // private _remote: string | null | undefined,
    ) { }

    get packageJSON() { return this._packageJSON }
    get type() { return this._type }
    get location() { return this._location }
    get sourceFolders() { return this.tsconfig.options.baseUrl ?? path.join(this.location, "src") }
    get outFolder() { return this.tsconfig.options.outDir ?? path.dirname(this.tsconfig.options.outFile ?? "") ?? path.join(this.location, "lib") }
    get name() { return this._packageJSON.name }
    private _remote: string | null | undefined;
    async remote() {
        if (!this._remote) this._remote = await Remote.get(this.name);
        return this._remote;
    }

    private _tsconfig: ts.ParsedCommandLine | undefined;
    get tsconfig() {
        if (this._tsconfig) return this._tsconfig;

        let location = Arguments.has("prod") ? path.join(this.location, "tsconfig.prod.json") : path.join(this.location, "tsconfig.json");
        if (!fs.existsSync(location)) location = path.join(this.location, "tsconfig.json");
        if (!fs.existsSync(location)) throw new Error("no location found for tsconfig");

        const configFile = ts.readConfigFile(location, ts.sys.readFile);
        if (configFile.error)
        {
            throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
        }

        this._tsconfig = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname(location)
        );

        return this._tsconfig;
    }

    descendants() {
        const output: Node[] = [];
        const visited = new Set<Node>();
        const stack = [...this.children];

        while (stack.length)
        {
            const node = stack.pop()!;
            if (visited.has(node)) continue;

            visited.add(node);
            output.push(node);
            stack.push(...node.children);
        }

        return output;
    }
    ancestors() {
        const output: Node[] = [];
        const visited = new Set<Node>();
        const stack = [...this.parents];

        while (stack.length)
        {
            const node = stack.pop()!;
            if (visited.has(node)) 
            {
                // need to push higher up for dependency order 
                continue;
            }

            visited.add(node);
            output.push(node);
            stack.push(...node.parents);
        }

        return output;
    }
}