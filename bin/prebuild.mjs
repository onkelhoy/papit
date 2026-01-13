import fs from "node:fs";
import path from "node:path";
import { spawnCommand } from "./spawn-command.mjs";

const root = process.cwd();

if (fs.existsSync(path.join(root, "node_modules/.bin/papit-build")))
    process.exit(0);

(async function () {
    console.log('running prebuild @papit/data-structure');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/algorithms/data-structure"));

    console.log('running prebuild @papit/deep-merge');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/algorithms/deep-merge"));

    console.log('running prebuild @papit/arguments');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/runtime/cli/arguments"));

    console.log('running prebuild @papit/terminal');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/runtime/cli/terminal"));

    console.log('running prebuild @papit/information');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/runtime/cli/information"));

    console.log('running prebuild @papit/build');
    await spawnCommand("node bin/prebuild.mjs", path.join(root, "packages/runtime/cli/build"));

    console.log('running build @papit/build');
    await spawnCommand("npm run build -- --force", path.join(root, "packages/runtime/cli/build"));

    console.log('running build @papit/server');
    await spawnCommand("npm run build", path.join(root, "packages/runtime/cli/server")); // making sure we can start things like test server for CI 

    await spawnCommand(process.env.CI ? "npm ci" : "npm install", root);
}());

