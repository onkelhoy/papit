import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot } from "./url";
import { LocalPackage, RootPackage } from "./types";
import { Remote } from "./remote";
import { Arguments, Loglevel } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import ts from "typescript";
import { deepMerge } from "@papit/deep-merge";

type DepedencyType = "dependencies" | "devDependencies" | "peerDependencies";

export class Dependency {
    root!: Node;
    private dictionary = new Map<string, Node>();
    static remote = new Remote();
    private initruners: Array<Function> = [];
    private initrunning = false;

    get(name: string) {
        return new Promise<Node | undefined>(res => {
            if (this.initrunning)
            {
                this.initruners.push(() => res(this.dictionary.get(name)));
            }
            else 
            {
                res(this.dictionary.get(name))
            }
        });
    }

    async build(location: string, entrypoints: string[] = []) {
        let close: Function | undefined;
        let update: ((text: string) => void) | undefined;
        if (Loglevel.info)
        {
            const loading = Terminal.loading("setting up dependency-graph");
            close = loading.close;
            update = loading.update
        }
        const session = Terminal.createSession();

        this.initrunning = true;
        const leftovers = new Map<string, [LocalPackage | RootPackage, DepedencyType]>();
        const rootPATH = findWorkspaceRoot(location);
        const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
        const scope = rootJSON.name.split("/").at(0);
        this.root = await this.createNode(scope, rootJSON, rootPATH, "root", leftovers);

        if (Arguments.has("remote"))
        {
            await Dependency.remote.init(scope);
        }

        const files = fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" }).filter(loc => {
            if (!loc.endsWith("package.json")) return false;
            if (/\/asset\//i.test(loc)) return false;
            // if (entrypoints.length > 0 && !entrypoints.includes(path.dirname(loc))) return false;

            return true;
        });

        for (let i = 0; i < files.length; i++)
        {
            const loc = files[i];
            if (update) update(`setting up dependency-graph (${i+1} / ${files.length})`);
            const location = path.join(rootPATH, "packages", loc);
            const packageJSON = JSON.parse(fs.readFileSync(location, { encoding: "utf-8" }));
            await this.createNode(scope, packageJSON, path.dirname(location), "local", leftovers);
        }

        for (const name of leftovers.keys())
        {
            console.log('running leftover', name)
            const [packageJSON, type] = leftovers.get(name) ?? [];
            if (!packageJSON) continue;
            await this.createNode(
                scope,
                packageJSON,
                path.dirname(location),
                name.startsWith(scope) ? "local" : "external",
                leftovers
            );


        }

        if (this.initruners.length > 0)
        {
            this.initruners.forEach(runner => runner());
            this.initruners = [];
        }
        this.initrunning = false;

        // Terminal.clearSession(session);
        if (close) close();

        // console.log(leftovers)
    }

    private async createNode(
        scope: string,
        packageJSON: LocalPackage | RootPackage,
        location: string,
        type: "external" | "root" | "local",
        leftovers: Map<string, [LocalPackage | RootPackage, DepedencyType]>,
    ) {
        if (!this.dictionary.has(packageJSON.name))
        {
            const remoteversion = await Dependency.remote.get(packageJSON.name);
            const node = new Node(
                packageJSON,
                type,
                location,
                remoteversion,
            );
    
            this.dictionary.set(packageJSON.name, node);
        }

        const node = this.dictionary.get(packageJSON.name)!;

        if (leftovers.has(packageJSON.name))
        {
            // should we address this one?
            leftovers.delete(packageJSON.name);
        }

        for (const dependencyType of ["dependencies", "devDependencies", "peerDependencies"] as const)
        {
            for (const key in packageJSON[dependencyType])
            {
                if (!key.startsWith(scope)) continue;

                const existingNode = 
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
    //     const stored = this.dictionary.get(dependency);
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
        private _remote: string | null | undefined,
    ) { }

    get packageJSON() { return this._packageJSON }
    get type() { return this._type }
    get location() { return this._location }
    get remote() { return this._remote }
    get sourceFolders() { return this.tsconfig.options.baseUrl ?? path.join(this.location, "src") }
    get outFolder() { return this.tsconfig.options.outDir ?? path.dirname(this.tsconfig.options.outFile ?? "") ?? path.join(this.location, "lib") }
    get name() { return this._packageJSON.name }

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

        while (stack.length) {
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

        while (stack.length) {
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