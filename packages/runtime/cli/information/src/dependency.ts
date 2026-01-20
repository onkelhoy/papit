import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot } from "./url";
import { LocalPackage, RootPackage } from "./types";
import { Remote } from "./remote";
import { Arguments, Loglevel } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import ts from "typescript";

type DepedencyType = "dependencies" | "devDependencies" | "peerDependencies";

class Node {
    dependencies: Array<{ node: Node, type: DepedencyType }> = [];
    descendants: Node[] = [];

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
    get sourceFolders() {
        const conf = this.tsconfig;
        return conf
    }
    get outFolder() {
        return null
        // const conf = this.tsconfig;
        // return conf?.options.outDir ?? path.dirname(conf?.options.outFile ?? "");
    }

    private _tsconfig: { data: ts.ParsedCommandLine, timestamp: number } | undefined;
    private _tsconfiglocation: string | undefined;
    get tsconfig() {
        if (this._tsconfig) 
        {
            let can = true;
            if (this._tsconfiglocation) 
            {
                const stat = fs.statSync(this._tsconfiglocation)
                if (stat.mtimeMs !== this._tsconfig.timestamp) can = false;
            }
            if (can) return this._tsconfig.data;
        }

        let location = this._tsconfiglocation ?? Arguments.has("prod") ? path.join(this.location, "tsconfig.prod.json") : path.join(this.location, "tsconfig.json");
        if (!fs.existsSync(location)) location = path.join(this.location, "tsconfig.json");
        if (!fs.existsSync(location)) throw new Error("no location found for tsconfig");
        const configFile = ts.readConfigFile(location, ts.sys.readFile);
        if (configFile.error)
        {
            throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
        }
        this._tsconfiglocation = location;
        this._tsconfig = {
            data: ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                this.location
            ),
            timestamp: fs.statSync(location).mtimeMs,
        }
    }
}

export class Dependency {
    root!: Node;
    private dictionary = new Map<string, Node>();
    static remote = new Remote();
    private initruners: Array<Function> = [];
    private initrunning = false;

    constructor(location = process.cwd()) {
        this.init(location);
    }

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

    async init(location: string, entrypoints: string[] = []) {
        let close: Function | undefined;
        if (Loglevel.info)
        {
            const loading = Terminal.loading("setting up dependency-graph");
            close = loading.close;
        }
        const session = Terminal.createSession();

        this.initrunning = true;
        const leftovers = new Map<string, [LocalPackage | RootPackage, DepedencyType]>();
        const rootPATH = findWorkspaceRoot(location);
        const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
        const scope = rootJSON.name.split("/").at(0);
        this.root = await this.create(scope, rootJSON, rootPATH, "root", leftovers);

        if (Arguments.has("remote"))
        {
            await Dependency.remote.init(scope);
        }

        const files = fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" }).filter(loc => {
            if (!loc.endsWith("package.json")) return false;
            if (/\/asset\//i.test(loc)) return false;
            if (entrypoints.length > 0 && !entrypoints.includes(path.dirname(loc))) return false;

            return true;
        });

        for (let i = 0; i < files.length; i++)
        {
            const loc = files[i];

            const location = path.join(rootPATH, "packages", loc);
            const packageJSON = JSON.parse(fs.readFileSync(location, { encoding: "utf-8" }));
            await this.create(scope, packageJSON, path.dirname(location), "local", leftovers);
        }

        for (const name in leftovers)
        {
            const [packageJSON, type] = leftovers.get(name) ?? [];
            if (!packageJSON) continue;
            await this.create(
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

        Terminal.clearSession(session);
        if (close) close();
    }

    private async create(
        scope: string,
        packageJSON: LocalPackage | RootPackage,
        location: string,
        type: "external" | "root" | "local",
        leftovers: Map<string, [LocalPackage | RootPackage, DepedencyType]>,
    ) {
        const remoteversion = await Dependency.remote.get(packageJSON.name);
        const node = new Node(
            packageJSON,
            type,
            location,
            remoteversion,
        );

        this.dictionary.set(packageJSON.name, node);
        leftovers.delete(packageJSON.name);

        for (const type of ["dependencies", "devDependencies", "peerDependencies"] as const)
            for (const key in packageJSON[type])
            {
                if (key.startsWith(scope))
                    this.append(scope, node, key, type, leftovers);
            }

        return node;
    }

    private append(
        scope: string,
        node: Node,
        dependency: string,
        type: DepedencyType,
        leftovers: Map<string, [LocalPackage | RootPackage, DepedencyType]>,
    ) {
        const stored = this.dictionary.get(dependency);
        if (stored)
        {
            node.dependencies.push({ node: stored, type });
            stored.descendants.push(node);

            leftovers.delete(dependency);
        }
        else 
        {
            leftovers.set(dependency, [node.packageJSON, type]);
        }
    }
}