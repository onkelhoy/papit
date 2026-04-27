import { jsBundle, getArguments, getTSconfig, getEntryPoints } from "@papit/bundle-js";
import { tsBundle } from "@papit/bundle-ts";

import packageJSON from '../package.json' with {type: 'json'};

const STATE_COLOR = {
    failed: 31,  // RED 
    success: 32, // GREEN
    skipped: 34, // BLUE 
}
const printState = (dim, state, name) => {
    if (process.stdout.isTTY)
    {
        process.stdout.write(`\x1b[${STATE_COLOR[state]}m● \x1b[0m${dim} \x1b[${STATE_COLOR[state]}m${state}\x1b[0m - ${name}\n`);
    }
    else
    {
        process.stdout.write(`●  ${state} - ${name}\n`);
    }
}

(async function () {

    const args = getArguments();

    const location = process.cwd();
    const tsconfig = getTSconfig(args, location);
    const entryPoints = getEntryPoints(location, packageJSON, tsconfig);

    const bundlejs = await jsBundle(args, location,
        {
            packageJSON,
            entryPoints,
            tsconfig
        }
    );

    if (bundlejs && bundlejs !== "skipped" && bundlejs.length > 0)
    {
        printState("prebuild js-bundle", "failed", packageJSON.name);

        if (args.has("error")) res.forEach(node => console.log(node.result.errors));
        process.exit(1);
    }

    const bundlets = await tsBundle(args, location,
        {
            entryPoints,
            packageJSON,
            tsconfig,
        }
    );

    if (bundlets && bundlets !== "skipped" && bundlets.length > 0)
    {
        printState("prebuild ts-bundle", "failed", packageJSON.name);

        if (args.has("error")) bundlets.forEach(node => console.log(node.result.errors));
        process.exit(1);
    }


    if (bundlejs === "skipped" && bundlets === "skipped") 
    {
        printState("prebuild", "skipped", packageJSON.name);
        return;
    }

    printState("prebuild", "success", packageJSON.name);
}());