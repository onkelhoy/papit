import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { Arguments } from "@papit/arguments";

import { Remote } from "./remote";
import { LocalPackage, RootPackage } from "./types";
import { getEntryPoints } from "./entrypoint";
import { Cache } from "./cache";

export class PackageNode<T extends LocalPackage | RootPackage = LocalPackage> {
    parents: PackageNode<LocalPackage>[] = [];
    children: PackageNode<LocalPackage>[] = [];

    constructor(
        private _packageJSON: T,
        private _type: "external" | "root" | "local",
        private _location: string,
    ) { }

    get packageJSON() { return this._packageJSON }
    get type() { return this._type }
    get location() { return this._location }
    get sourceFolder() { return path.relative(this.location, this.tsconfig.options.baseUrl ?? path.join(this.location, "src")) }
    get outFolder() { return path.relative(this.location, this.tsconfig.options.outDir ?? path.dirname(this.tsconfig.options.outFile ?? "") ?? path.join(this.location, "lib")) }
    get name() { return this._packageJSON.name }
    private _externals: string[] | undefined;
    get externals() {
        if (!this._externals) 
        {
            this._externals = Object
                .keys(this.packageJSON.dependencies ?? {})
                .concat(Object.keys(this.packageJSON.devDependencies ?? {}))
                .concat(Object.keys(this.packageJSON.peerDependencies ?? {}))
        }
        return this._externals;
    }
    private _remote: string | null | undefined;
    async remote() {
        if (!this._remote) this._remote = await Remote.get(this.name);
        return this._remote;
    }

    set modifiedtime(value: number) {
        Cache.set(this.name, { mtime: value });
    }
    get modifiedtime(): { current: number, previous: number | undefined } {
        let mtime = 0;
        const joined = path.join(this.location, this.sourceFolder);
        fs
            .readdirSync(joined, { recursive: true, encoding: "utf-8" })
            .map(file => path.join(joined, file))
            .concat(path.join(this.location, "package.json"), path.join(this.location, "tsconfig.json"))
            .forEach(file => {
                try 
                {
                    const stat = fs.statSync(file);
                    if (!stat.isFile()) return;
    
                    mtime = Math.max(mtime!, stat.mtimeMs);
                }
                catch {}
            });
        
        const previous = Cache.get(this.name)?.mtime;
        Cache.set(this.name, { mtime });
        return {
            current: mtime,
            previous,
        };
    }

    private _entrypoints: ReturnType<typeof getEntryPoints> | undefined;
    get entrypoints() {
        if (!this._entrypoints)
        {
            this._entrypoints = getEntryPoints(this as PackageNode<LocalPackage>)
        }

        return this._entrypoints;
    }

    private _tsconfig: ts.ParsedCommandLine | undefined;
    private _tsconfigpath: string | undefined;
    get tsconfigpath() {
        if (!this._tsconfigpath)
        {
            this._tsconfigpath = Arguments.has("prod") ? path.join(this.location, "tsconfig.prod.json") : path.join(this.location, "tsconfig.json");
            if (!fs.existsSync(this._tsconfigpath)) this._tsconfigpath = path.join(this.location, "tsconfig.json");
            if (!fs.existsSync(this._tsconfigpath)) throw new Error("no location found for tsconfig");
        }

        return this._tsconfigpath;
    }
    get tsconfig() {
        if (!this._tsconfig) 
        {
            const configFile = ts.readConfigFile(this.tsconfigpath, ts.sys.readFile);
            if (configFile.error)
            {
                throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
            }
    
            this._tsconfig = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                path.dirname(this.tsconfigpath)
            );
        }

        return this._tsconfig;
    }

    get descendants() {
        const output: PackageNode[] = [];
        const visited = new Set<PackageNode>();
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
    get ancestors() {
        const output: PackageNode[] = [];
        const visited = new Set<PackageNode>();
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