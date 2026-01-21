// import statements 
import { type PackageNode } from "./node";

type Entry<T = {output:string, input:string}> = {import:T|undefined,require:T|undefined,types:T|undefined};
type Entries = Record<string, Entry>;
function getOutputInput(output: string, node: PackageNode) 
{
    return { output, input: output.replace(node.sourceFolder+"/", node.outFolder+"/") };
}
function add(entries: Entries, key: string, node: PackageNode, entry: Partial<Entry<string>>) 
{
    if (!entries[key]) entries[key] = { import: undefined, types: undefined, require: undefined };

    for (const e in entry) 
    {
        const output = entry[e as keyof Entry];
        if (output) entries[key][e as keyof Entry] = getOutputInput(output, node);
    }
}
function addString(entries: Entries, key: string, node: PackageNode, output: string) {
    const entry = node.packageJSON.type === "commonjs" ? "require" : "import";
    add(entries, key, node, { [entry]: output });
}

function extract(node:PackageNode, property: "bin"|"entryPoints", entries: Entries) 
{
    if (!node.packageJSON[property]) return

    if (typeof node.packageJSON[property] === "string")
    {
        addString(entries, "bundle", node, node.packageJSON[property])
        return;
    }

    for (const key in node.packageJSON[property])
    {
        addString(entries, property, node, node.packageJSON[property][key])
    }
}

export function getEntryPoints(node: PackageNode) {
    const entries: Entries = {};
    
    if (node.packageJSON.main) addString(entries, "bundle", node, node.packageJSON.main);
    
    extract(node, "entryPoints", entries);
    extract(node, "bin", entries);

    if (typeof node.packageJSON.exports === "string")
    {
        addString(entries, "bundle", node, node.packageJSON.exports);
        return entries;
    }

    for(const key in node.packageJSON.exports)
    {
        if (!node.packageJSON.exports[key]) continue;

        const name = key === "." ? "bundle" : key;
        if (typeof node.packageJSON.exports[key] === "string")
        {
            addString(entries, name, node, node.packageJSON.exports[key]);
            continue;
        }

        add(entries, name, node, node.packageJSON.exports[key]);
    }

    return entries;
}
