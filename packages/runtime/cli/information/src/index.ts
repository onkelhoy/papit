// exports
export * from "./dependency";
export * from "./types";


// EXAMPLE: 
// import { Dependency } from "./dependency";

// (async function () {
//     const graph = new Dependency();

//     const node = graph.get("@papit/html")!;
//     const remote = await node.remote();
//     console.log({ name: node.name, children: node.descendants().map(a => a.name), parents: node.ancestors().map(a => a.name), remote });
// }())