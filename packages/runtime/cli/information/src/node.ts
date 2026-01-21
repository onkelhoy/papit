import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { Arguments } from "@papit/arguments";

import { Remote } from "./remote";
import { LocalPackage, RootPackage } from "./types";
import { getEntryPoints } from "./entrypoint";

export class PackageNode {
    parents: PackageNode[] = [];
    children: PackageNode[] = [];

    constructor(
        private _packageJSON: LocalPackage | RootPackage,
        private _type: "external" | "root" | "local",
        private _location: string,
        // private _remote: string | null | undefined,
    ) { }

    get packageJSON() { return this._packageJSON }
    get type() { return this._type }
    get location() { return this._location }
    get sourceFolder() { return this.tsconfig.options.baseUrl ?? path.join(this.location, "src") }
    get outFolder() { return this.tsconfig.options.outDir ?? path.dirname(this.tsconfig.options.outFile ?? "") ?? path.join(this.location, "lib") }
    get name() { return this._packageJSON.name }
    private _remote: string | null | undefined;
    async remote() {
        if (!this._remote) this._remote = await Remote.get(this.name);
        return this._remote;
    }

    private _entrypoints: ReturnType<typeof getEntryPoints>|undefined;
    get entrypoints() {
        if (!this._entrypoints)
        {
            this._entrypoints = getEntryPoints(this)
        }

        return this._entrypoints;
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