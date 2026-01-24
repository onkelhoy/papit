// import statements 
import path from "node:path";
import fs from "node:fs";
import { type PackageNode } from "./node";

export type EntryPoint<T = { output: string, input: string }> = { import: T | undefined, require: T | undefined, types: T | undefined };
type Entries = Record<string, EntryPoint>;

export function getEntryPoints(node: PackageNode) {
    const entries: Entries = {};
    const bin = new Map<string, string>();
    const outputs = new Map<string, string>();

    if (node.packageJSON.main) addString(entries, outputs, "bundle", node, node.packageJSON.main);
    if (node.packageJSON.types) add(entries, outputs, "bundle", node, { types: node.packageJSON.types });

    extract(entries, outputs, node, "entryPoints");
    extract(entries, outputs, node, "bin");
    extract({}, bin, node, "bin"); // we use this for info

    if (typeof node.packageJSON.exports === "string")
    {
        addString(entries, outputs, "bundle", node, node.packageJSON.exports);
    }
    else 
    {
        for (const key in node.packageJSON.exports)
        {
            if (!node.packageJSON.exports[key]) continue;

            const name = key === "." ? "bundle" : key;
            if (typeof node.packageJSON.exports[key] === "string")
            {
                addString(entries, outputs, name, node, node.packageJSON.exports[key]);
                continue;
            }

            add(entries, outputs, name, node, node.packageJSON.exports[key]);
        }
    }

    // cleanup 
    for (const key in entries)
    {
        if (entries[key].import === undefined && entries[key].types === undefined && entries[key].require === undefined)
            delete entries[key];
    }
    return { outputs, entries, bin };
}

// helper functions 
function add(entries: Entries, map: Map<string, string>, key: string, node: PackageNode, entry: Partial<EntryPoint<string>>) {
    if (!entries[key]) entries[key] = { import: undefined, types: undefined, require: undefined };

    for (const e in entry) 
    {
        const output = entry[e as keyof EntryPoint];
        if (!output) continue;

        const inputoutput = getOutputInput(output, node);
        if (map.has(inputoutput.output)) continue;

        map.set(inputoutput.output, key);
        entries[key][e as keyof EntryPoint] = inputoutput;
    }
}
function addString(entries: Entries, map: Map<string, string>, key: string, node: PackageNode, output: string) {
    const entry = node.packageJSON.type === "commonjs" ? "require" : "import";
    add(entries, map, key, node, { [entry]: output });
}
function extract(entries: Entries, map: Map<string, string>, node: PackageNode, property: "bin" | "entryPoints") {
    if (!node.packageJSON[property]) return

    if (typeof node.packageJSON[property] === "string")
    {
        addString(entries, map, "bundle", node, node.packageJSON[property])
        return;
    }

    for (const key in node.packageJSON[property])
    {
        addString(entries, map, key, node, node.packageJSON[property][key])
    }
}
function getOutputInput(output: string, node: PackageNode) {
    let input = output.replace(node.outFolder + "/", node.sourceFolder + "/").replace(/\.js$/, ".ts");
    if (!fs.existsSync(path.join(node.location, input))) input = path.join(node.sourceFolder, "index.ts");

    return { output: path.join(node.location, output), input: path.join(node.location, input) };
}