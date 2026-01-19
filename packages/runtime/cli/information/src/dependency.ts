import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot } from "./url";
import { LocalPackage, RootPackage } from "./types";

class Node {
    dependencies: Node[] = [];
    peerDependencies: Node[] = [];
    devDependencies: Node[] = [];

    descendants: Node[] = []; 

    value: undefined | {
        name: string;
        type: "external"|"root"|"local";
        location: string;
        version: string;
        remote: string|null;
    }
}

export class Dependency {
    root: Node;
    dictionary = new Map<string, Node>();
    
    private map = new Map<string, [string, "dependencies"|"devDependencies"|"peerDependencies"]>();
    constructor(location = process.cwd()) 
    {
        const rootPATH = findWorkspaceRoot(location);
        const rootJSON = JSON.parse(fs.readFileSync(path.join(rootPATH, "package.json"), { encoding: "utf-8" }));
        this.root = this.createNode(rootJSON, rootPATH);

        const files = fs.readdirSync(path.join(rootPATH, "packages"), { recursive: true, encoding: "utf-8" });
        files.forEach(loc => {
            if (!loc.endsWith("package.json")) return;
            if (/\/asset\//i.test(loc)) return;

            console.log(loc);
        })
    }

    private appendDependency(node: Node, dependency: string, type: "dependencies"|"devDependencies"|"peerDependencies")
    {
        const stored = this.dictionary.get(dependency);
        if (stored)
        {
            node[type].push(stored);
        }
        else 
        {
            this.map.set(dependency, [node.value!.name, type]);
        }
    }

    private createNode(packageJSON: LocalPackage|RootPackage, location: string) {
        const node = new Node();
        node.value = {
            name: packageJSON.name,
            location,
            version: packageJSON.version,
            remote: null,
            type: "root"
        }

        this.dictionary.set(packageJSON.name, node);
        
        for (const type of ["dependencies", "devDependencies", "peerDependencies"] as const)
        for (const key in packageJSON[type])
            this.appendDependency(node, key, type);

        // packageJSON.dependencies = 
        // node.ancestors

        return node;
    }
}