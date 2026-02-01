import ts from "typescript";
import { Node, NodeType } from "graph-experiment/node";
import { TS } from "graph-experiment/utils/typescript";
import { NodeMap, type Item } from "graph-experiment/map";
import { Area } from "graph-experiment/node/area";
import { logger } from "graph-experiment/utils/logger";

const { log } = logger("graph");

type Edge = {
    from: Node;
    to: Node;
    type: "import" | "fxport";
    alias?: string;
    name: string,
}

type GetImport = NonNullable<ReturnType<typeof Area['getImport']>>;
type GetFxport = NonNullable<ReturnType<typeof Area['getFxport']>>;

export class Graph {
    edges: Edge[] = [];
    private source: ts.SourceFile;
    private identities: {
        record: Map<string, ts.Identifier>;
        map: Map<ts.Identifier, string>;
    };

    get fileName() {
        return this.source.fileName;
    }

    private nodes: Record<NodeType, Node[]> & {
        map: Map<Node, NodeType>,
        aliasExports: string[],
    };

    constructor(item: Item) {
        this.identities = {
            record: new Map(),
            map: new Map(),
        }

        this.nodes = {
            map: new Map(),
            import: [],
            fxport: [],
            type: [],
            export: [],
            aliasExports: [],
        }

        this.source = item.source;
        for (const node of item.nodes)
        {
            this.add(node);
        }
    }


    add(node: Node) {

        if (this.nodes.map.has(node)) return;
        // {
        //     // NOTE this is almost working btu then we dont print the alias keys like the D, but without it we dont get C and B as exports.. 
        //     if (first && comming === "fxport")
        //     {
        //         log("found one", node.print())
        //         const idx = this.nodes.type.findIndex(n => n === node);
        //         if (idx >= 0) 
        //         {
        //             this.nodes.type.splice(idx, 1);
        //             this.nodes.export.push(node);
        //         }
        //     }
        //     return;
        // }

        node.stamp(this.source.fileName); // we mark so we would know which to put in a common 

        this.setIdentity(node);

        if (this.addExternal(node, "fxport")) 
        {
            this.nodes.map.set(node, "fxport");
            return;
        }
        if (this.addExternal(node, "import")) 
        {
            this.nodes.map.set(node, "import");
            return;
        }

        if (this.source === node.source && node.type === "export")
        {
            this.nodes.export.push(node);
            this.nodes.map.set(node, "export");
        }
        else 
        {
            this.nodes.type.push(node);
            this.nodes.map.set(node, "type");
        }
    }

    print() {
        TS.RENAME_MAP = this.identities.map; // this will make sure name collisons wont occur 

        // const fxportTargets = new Set(
        //     this.edges
        //         .filter(e => e.type === "fxport" && e.from.source === this.source)
        //         .map(e => e.to)
        // );

        // const types   = this.nodes.type.filter(n => !fxportTargets.has(n));
        // const exports = [
        //     ...this.nodes.export,
        //     ...this.nodes.type.filter(n => fxportTargets.has(n)),
        // ];

        const hasExternals = (this.nodes.fxport.length + this.nodes.import.length) > 0;
        return [
            this.nodes.fxport.map(this.printFxport).join("\n"),
            this.nodes.import.map(this.printImport).join("\n"),
            hasExternals ? "\n\n" : null,
            "/* types */",
            this.nodes.type.map(this.printType).flat(2).join("\n"),
            " ",
            "/* exports */",
            this.nodes.aliasExports.join("\n"),
            this.nodes.export.map(n => n.print()).join("\n"),
        ].filter(Boolean).join("\n");
    }

    private setIdentity(node: Node) {
        if (!node.identity) return;

        const text = node.identity.text;
        if (!this.identities.record.has(text))
        {
            this.identities.record.set(text, node.identity);
            this.identities.map.set(node.identity, text);
            return;
        }

        let num = 1;
        while (this.identities.record.has(text + num))
        {
            num++;
        }

        this.identities.record.set(text + num, node.identity);
        this.identities.map.set(node.identity, text + num);
    }

    private addExternal(node: Node, type: "import" | "fxport") {
        const target = node[type];

        if (!target || !target.resolvedFileName) return false;

        if (target.external)
        {
            // const found = this.nodes[type].find(i => i.resolvedFileName === target?.resolvedFileName);
            // if (found)
            // {
            //     found.imports.push(...target?.imports);
            //     found.namespaceAlias.push(...target.namespaceAlias);
            //     if (type === "import")
            //     {
            //         (found as GetImport).defaultAlias.push(...(target as GetImport).defaultAlias);
            //     }
            // }
            // else 
            // {
            //     (this.nodes[type] as Array<typeof target>).push(target);
            // }
            this.nodes[type].push(node);
            return true;
        }

        for (const imp of target.imports)
        {
            let ref: Node | null | undefined;
            let name = imp.name;

            if (type === "fxport")
            {
                const resolved = this.resolveFxport(imp.name, target.resolvedFileName);
                if (!resolved)
                {
                    log("could not find fxport reference\n", node.print(), "\n", imp, target.resolvedFileName);
                    continue;
                }
                ref = resolved.node;
                name = resolved.name;
            } else
            {
                ref = NodeMap.find(imp.name, target.resolvedFileName);
                if (!ref)
                {
                    log("could not find import reference\n", node.print(), "\n", imp, target.resolvedFileName);
                    continue;
                }
            }

            this.edges.push({
                from: node,
                to: ref,
                type,
                name,
                alias: imp.alias,
            });

            this.add(ref);
            // // const ref = NodeMap.find(imp.name, target.resolvedFileName);
            // // if (!ref) 
            // // {
            // //     log("could not find import reference\n", node.print(), "\n", imp, target.resolvedFileName)
            // //     continue;
            // // }

            // const resolved = this.resolveFxport(imp.name, target.resolvedFileName);
            // if (!resolved)
            // {
            //     log("could not find import reference\n", node.print(), "\n", imp, target.resolvedFileName);
            //     continue;
            // }

            // // maybe we need to look at whats used? 
            // // node.uses // ts.Identifier[] -> instead of use... maybe not? im not sure 

            // this.edges.push({
            //     from: node,
            //     to: resolved.node,
            //     type,
            //     name: resolved.name,
            //     alias: imp.alias,
            // });

            // // log("we add edge", { from: node.print(), to: ref.identity?.text, ref: ref.print() })


            // // if (type === "fxport")
            // // {
            // //     const type = this.nodes.map.get(ref);
            // //     if (type === "type")
            // //     {

            // //     }
            // // }

            // this.add(resolved.node);
        }

        return true;
    }

    private resolveFxport(name: string, fileName: string): { node: Node; name: string } | null {
        const ref = NodeMap.find(name, fileName);
        if (!ref) return null;

        // if ref is itself a fxport, follow through
        if (ref.fxport?.resolvedFileName && !ref.fxport.external)
        {
            const imp = ref.fxport.imports.find(i => i.alias === name || i.name === name);
            if (imp)
            {
                const resolved = this.resolveFxport(imp.name, ref.fxport.resolvedFileName);
                if (resolved)
                {
                    // keep final node, but name comes from the final destination
                    return resolved;
                }
            }
        }

        return { node: ref, name };
    }

    private printType = (node: Node) => {
        const references = this.edges.filter(edge => edge.to === node);
        const aliases = references.filter(edge => edge.alias && edge.alias !== edge.name);
        // const isExport = references.some(ref => ref.type === "fxport");
        const isExport = references.some(ref => ref.type === "fxport" && ref.from.source === this.source);

        if (isExport) 
        {
            if (aliases.length > 0) // this.nodes.aliasExports
            {
                aliases.forEach(edge => this.nodes.aliasExports.push(`export type ${edge.alias} = ${edge.name};`));
                return node.print().replace(/^export /, '');
            }
            else 
            {
                this.nodes.export.push(node);
                this.nodes.map.set(node, "export"); // do we even need this?
                return null;
            }
        }

        const printed = node.print().replace(/^export /, '');
        if (!aliases) return [printed];
        return [
            printed,
            aliases.map(edge => `type ${edge.alias} = ${edge.name};`),
        ];
    }

    private printFxport = (node: Node) => {
        if (!node.fxport?.importPath) return null;

        const indeces = new Set<number>();
        const nodes = this.nodes.fxport.filter((n, index) => {
            const value = n.fxport?.importPath === node.fxport?.importPath;
            if (value) indeces.add(index);

            return value;
        });

        for (const n of nodes)
        {
            const ancestors = this.edges.filter(edge => edge.to === n);
            log(n.print(), ancestors.map(ans => ({ name: ans.name, alias: ans.alias })));
        }

        // now we make sure to remove ALL that was found 
        this.nodes.fxport = this.nodes.fxport.map((node, i) => indeces.has(i) ? null : node).filter(node => node !== null);
    }

    private printImport = (node: Node) => {

    }

    // private _printFxport = (item: GetFxport) => {
    //     if (item.namespaceAlias)
    //     {
    //         return `export * as ${item.namespaceAlias} from "${item.importPath}";`;
    //     }

    //     if (item.star)
    //     {
    //         return `export * from "${item.importPath}";`;
    //     }

    //     return `export { ${item.imports.map(i => i.name === i.alias ? i.name : `${i.name} as ${i.alias}`).join(", ")} } from "${item.importPath}";`;
    // }

    // private _printImport = (item: GetImport) => {

    //     if (item.defaultAlias)
    //     {
    //         return item.defaultAlias.map(def => `import ${item.defaultAlias} from "${item.importPath}";`;
    //     }

    //     if (item.sideEffectOnly)
    //     {
    //         return `import "${item.importPath}";`;
    //     }

    //     return `export { ${item.imports.map(i => i.name === i.alias ? i.name : `${i.name} as ${i.alias}`).join(", ")} } from "${item.importPath}";`;
    // }
}