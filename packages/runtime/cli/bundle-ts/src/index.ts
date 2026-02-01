// import path from "node:path";
// import { getArguments } from "@papit/bundle-js";
// import { tsBundle } from "./bundler";

// export 
export { tsBundle } from "./bundler";
// import "./graph-experiment";

// (function () {
//     const args = getArguments(); // could be "heavy" 

//     if (!args.has("run-bundle-ts") && !(process.env.npm_lifecycle_event === "npx" && !!process.env._?.endsWith("papit-bundle-ts"))) return;

//     tsBundle(
//         args,
//         process.cwd(),
//         [
//             { input: path.join(process.cwd(), "src/index.ts"), output: path.join(process.cwd(), "lib/bundle.d.ts") },
//         ]
//     );
// }())