// exports
export * from "./graph";
export * from "./node";
export * from "./information";
export * from "./remote";
export * from "./types";
export * from "./entrypoint";

// PackageGraph.nodes.forEach(n => console.log(n.name, n.location))

// EXAMPLE: 
// import { PackageGraph } from "@papit/information";

// (async function () {
//     const node = PackageGraph.get("@papit/html")!;
//     const remote = await node.remote();
//     console.log({ name: node.name, children: node.descendants().map(a => a.name), parents: node.ancestors().map(a => a.name), remote });
// }())

// import { Terminal } from "@papit/terminal";
// import { Arguments } from "@papit/arguments";
// import { PackageGraph } from "./graph";
// import { Information } from "./information";

// (async function () {
//     if (!Arguments.isCLI || !process.env._?.endsWith("papit-information")) return;
//     if (Arguments.has("location")) return console.log({ local: Information.local, root: Information.root, package: Information.package });

//     while (true)
//     {
//         Terminal.write();
//         const ans = await Terminal.option(["location", "package"]);
//         if (ans.index === 0)
//         {
//             console.log({
//                 local: Information.local,
//                 root: Information.root.location,
//                 package: Information.package.location
//             });
//             continue;
//         }

//         const selected = await Terminal.option(PackageGraph.nodes.map(node => node.name));
//         const node = PackageGraph.get(selected.text)!;
//         const pkgans = await Terminal.option(["name", "location", "version", "remote", "outFolder", "descendants", "ancestors"], node.name);
//         switch (pkgans.text)
//         {
//             case "name":
//                 console.log(node.name);
//                 break;
//             case "location":
//                 console.log(node.location);
//                 break;
//             case "version":
//                 console.log(node.packageJSON.version);
//                 break;
//             case "remote":
//                 const remote = await node.remote;
//                 console.log(remote);
//                 break;
//             case "outFolder":
//                 console.log(node.outFolder);
//                 break;
//             case "descendants":
//                 console.log(node.descendants.map(p => p.name));
//                 break;
//             case "ancestors":
//                 console.log(node.ancestors.map(p => p.name));
//                 break;

//         }
//     }
// }());

