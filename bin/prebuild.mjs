import fs from "node:fs";
import path from "node:path";
import { spawnCommand } from "./spawn-command.mjs";

const root = process.cwd();

if (fs.existsSync(path.join(root, "node_modules/.bin/papit-build")))
    process.exit(0);

const prebuilds = [
    { name: "@papit/bundle-js", location: "packages/runtime/cli/bundle-js" },
    { name: "@papit/bundle-ts", location: "packages/runtime/cli/bundle-ts" },
    { name: "@papit/data-structure", location: "packages/algorithms/data-structure" },
    { name: "@papit/deep-merge", location: "packages/algorithms/deep-merge" },
    { name: "@papit/arguments", location: "packages/runtime/cli/arguments" },
    { name: "@papit/terminal", location: "packages/runtime/cli/terminal" },
    { name: "@papit/information", location: "packages/runtime/cli/information" },
    { name: "@papit/build", location: "packages/runtime/cli/build" },
];

(async function () {

    for (const { name, location } of prebuilds)
    {
        console.log('running prebuild', name);
        await spawnCommand("node bin/prebuild.mjs", path.join(root, location));
    }

    console.log('running build @papit/build');
    await spawnCommand("npm run build -- --force", path.join(root, "packages/runtime/cli/build"));

    console.log('running build @papit/server');
    await spawnCommand("npm run build", path.join(root, "packages/runtime/cli/server")); // making sure we can start things like test server for CI 

    await spawnCommand(process.env.CI ? "npm ci" : "npm install", root);
}());

