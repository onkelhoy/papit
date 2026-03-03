import ts from "typescript";
import path from "path";
import { TS } from "graph-experiment/utils/typescript"
import { logger } from "graph-experiment/utils/logger";
import { NodeMap } from "graph-experiment/map";
import { Node } from "graph-experiment/node";
import { Graph } from "./graph";

const { log } = logger("graph-experiment");

(function () {
    const files = [
        "./src/experiment/test/a.ts",
        // "./src/experiment/test/b.ts",
        // "./src/experiment/test/c.ts",
    ].map(v => path.resolve(v));

    bundler(process.cwd(), files);
}())


function bundler(location: string, files: string[]) {
    // this initializes the static class 
    TS.init(location, files, {});

    // const map = new Map<ts.SourceFile, Node[]>();
    NodeMap.init();

    const graphs = NodeMap
        .toArray()
        .filter(item => item.entry)
        .map(item => new Graph(item));

    for (const graph of graphs)
    {
        log("PRINT\n", `======== ${path.basename(graph.fileName)} =======\n\n`, graph.print(), "\n");
    }
    // for (const item of NodeMap.toArray())
    // {
    //     if (!item.entry) continue;

    //     const graph = new Graph(item.nodes);
        
    //     // const nodes: Node[] = [];

    //     // for (const node of item.nodes) 
    //     // {
            

    //     //     if (node.import)
    //     //     {
    //     //         if (node.import.external) 
    //     //         {
    //     //             log("external", node.print());
    //     //         }
    //     //     }

    //     //     // node.uses.forEach(use => {
    //     //     //     log("uses", use.text)
    //     //     // })

    //     //     if (["export", "fxport"].includes(node.type))
    //     //     {

    //     //         nodes.push(node);
    //     //     }
    //     // }

    //     // map.set(item.source, nodes);
    // }
}