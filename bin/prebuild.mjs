import fs from "node:fs";
import path from "node:path";
import {spawnCommand} from "./spawn-command.mjs";

const root = process.cwd();

if (fs.existsSync(path.join(root, "node_modules/.bin/papit-build")))
    process.exit(0);

(async function () {
    await spawnCommand("npm run prebuild", path.join(root, "packages/algorithms/data-structure"));
    await spawnCommand("npm run prebuild", path.join(root, "packages/runtime/cli/arguments"));
    await spawnCommand("npm run prebuild", path.join(root, "packages/runtime/cli/terminal"));
    await spawnCommand("npm run prebuild", path.join(root, "packages/runtime/cli/information"));
    await spawnCommand("npm run prebuild", path.join(root, "packages/runtime/cli/build"));
    await spawnCommand("npm run build -- --force", path.join(root, "packages/runtime/cli/build"));
    await spawnCommand("npm run build", path.join(root, "packages/runtime/cli/server")); // making sure we can start things like test server for CI 

    await spawnCommand(process.env.CI ? "npm ci" : "npm install", root);
}());

