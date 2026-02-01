// import statements 
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";
import { outFolder, type PackageJson, sourceFolder } from "./helper";

export type EntryPoint<T = { output: string, input: string }> = { import: T | undefined, require: T | undefined, types: T | undefined };
type Entries = Record<string, EntryPoint>;

export function getEntryPoints(
    location: string,
    packageJSON: PackageJson,
    tsconfig: ts.ParsedCommandLine,
) {
    const entries: Entries = {};
    const bin = new Map<string, string>();
    const outputs = new Map<string, string>();

    if (packageJSON.main) addString(location, packageJSON, tsconfig, entries, outputs, "bundle", packageJSON.main);
    if (packageJSON.types) add(location, tsconfig, entries, outputs, "bundle", { types: packageJSON.types });

    extract(location, packageJSON, tsconfig, entries, outputs, "entryPoints");
    extract(location, packageJSON, tsconfig, entries, outputs, "bin");
    extract(location, packageJSON, tsconfig, {}, bin, "bin"); // we use this for info

    if (typeof packageJSON.exports === "string")
    {
        addString(location, packageJSON, tsconfig, entries, outputs, "bundle", packageJSON.exports);
    }
    else 
    {
        for (const key in packageJSON.exports)
        {
            if (!packageJSON.exports[key]) continue;

            const name = key === "." ? "bundle" : key;
            if (typeof packageJSON.exports[key] === "string")
            {
                addString(location, packageJSON, tsconfig, entries, outputs, name, packageJSON.exports[key]);
                continue;
            }

            add(location, tsconfig, entries, outputs, name, packageJSON.exports[key]);
        }
    }

    // cleanup 
    for (const key in entries)
    {
        if (entries[key]?.import === undefined && entries[key]?.types === undefined && entries[key]?.require === undefined)
            delete entries[key];
    }
    return { outputs, entries, bin };
}

// helper functions 
function add(
    location: string,
    tsconfig: ts.ParsedCommandLine,
    entries: Entries,
    map: Map<string, string>,
    key: string,
    entry: Partial<EntryPoint<string>>
) {
    if (!entries[key]) entries[key] = { import: undefined, types: undefined, require: undefined };

    for (const e in entry) 
    {
        const output = entry[e as keyof EntryPoint];
        if (!output) continue;

        const inputoutput = getOutputInput(location, tsconfig, output);
        if (map.has(inputoutput.output)) continue;

        map.set(inputoutput.output, key);
        entries[key][e as keyof EntryPoint] = inputoutput;
    }
}
function addString(
    location: string,
    packageJSON: PackageJson,
    tsconfig: ts.ParsedCommandLine,
    entries: Entries,
    map: Map<string, string>,
    key: string,
    output: string
) {
    const entry = packageJSON.type === "commonjs" ? "require" : "import";
    add(location, tsconfig, entries, map, key, { [entry]: output });
}
function extract(
    location: string,
    packageJSON: PackageJson,
    tsconfig: ts.ParsedCommandLine,
    entries: Entries,
    map: Map<string, string>,
    property: "bin" | "entryPoints"
) {
    if (!packageJSON[property]) return

    if (typeof packageJSON[property] === "string")
    {
        addString(location, packageJSON, tsconfig, entries, map, "bundle", packageJSON[property])
        return;
    }

    for (const key in packageJSON[property])
    {
        addString(location, packageJSON, tsconfig, entries, map, key, packageJSON[property][key]!)
    }
}
function getOutputInput(
    location: string,
    tsconfig: ts.ParsedCommandLine,
    output: string,
) {
    const out = outFolder(location, tsconfig);
    const src = sourceFolder(location, tsconfig);

    let input = output.replace(out + "/", src + "/").replace(/\.js$/, ".ts");
    if (!fs.existsSync(path.join(location, input))) input = path.join(src, "index.ts");

    return { output: path.join(location, output), input: path.join(location, input) };
}