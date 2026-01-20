// exports
export * from "./dependency";
export * from "./types";

import { Dependency } from "./dependency";

(async function () {
    const graph = new Dependency();
    
    
    await graph.build(process.cwd(), ["runtime/cli/build"]);

    const node = await graph.get("@papit/build");

    console.log("data", node?.ancestors().map(a => a.name));
}())