// import { jsBundle } from "./bundler";
// import { getArguments } from "./helper";

// exports
export * from "./bundler";
export * from "./options";
export * from "./helper";
export * from "./changed";
export * from "./entrypoints";

// (async function () {
//     const args = getArguments(); // could be "heavy" 

//     if (!args.has("run-bundle-js") && !(process.env.npm_lifecycle_event === "npx" && !!process.env._?.endsWith("papit-bundle-js"))) return;

//     const location = process.cwd();
//     await jsBundle(args, location);
// }())