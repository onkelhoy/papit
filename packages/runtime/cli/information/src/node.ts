import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { Arguments } from "@papit/arguments";
import { getEntryPoints, getExternals, getTSconfig, getTSlocation, outFolder, sourceFolder } from "@papit/bundle-js";

import { Remote } from "./remote";
import type { LocalPackage, RootPackage } from "./types";
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
    get location() { return path.normalize(this._location) }

    savePackageJSON() {
        fs.writeFileSync(path.join(this.location, "package.json"), JSON.stringify(this.packageJSON, null, 4), { encoding: "utf-8" });
    }

    get sourceFolder() { return sourceFolder(this.location, this.tsconfig) }
    get outFolder() { return outFolder(this.location, this.tsconfig) }
    get name() { return this._packageJSON.name }
    private _externals: string[] | undefined;
    get externals() {
        if (!this._externals) 
        {
            this._externals = getExternals(this.packageJSON);
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
                catch { }
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
            this._entrypoints = getEntryPoints(this.location, this.packageJSON, this.tsconfig);
        }

        return this._entrypoints;
    }

    private _tsconfig: ts.ParsedCommandLine | undefined;
    private _tsconfigpath: string | undefined;
    get tsconfigpath() {
        if (!this._tsconfigpath)
        {
            this._tsconfigpath = getTSlocation(Arguments.instance, this.location);
            if (!fs.existsSync(this._tsconfigpath)) this._tsconfigpath = path.join(this.location, "tsconfig.json");
            if (!fs.existsSync(this._tsconfigpath)) throw new Error("no location found for tsconfig");
        }

        return this._tsconfigpath;
    }
    get tsconfig() {
        if (!this._tsconfig) 
        {
            this._tsconfig = getTSconfig(Arguments.instance, this.location, this.tsconfigpath);
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