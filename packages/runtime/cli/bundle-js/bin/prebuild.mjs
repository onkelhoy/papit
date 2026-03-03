import esbuild from "esbuild";
import fs from "node:fs";
import { spawn } from "node:child_process";

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
        process.stdout.write(`● {dim} ${state} - ${name}\n`);
    }
}

function spawnCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: "inherit",
            shell: false,
            env: { ...process.env },
        });

        child.on("close", code => {
            if (code === 0) resolve();
            else 
            {
                reject(new Error(`prebuild failed (${code})`));
                process.exit(1);
            }
        });
    });
}

function getArguments() {
    const args = new Set();
    for (let arg of process.argv.slice(2))
    {
        args.add(arg.replace(/^--/, ""));
    }

    return args;
}

const externals = [
    packageJSON.dependencies,
    packageJSON.devDependencies,
    packageJSON.peerDependencies
]
    .filter(Boolean)
    .flatMap(dep => Object.keys(dep));

(async function () {

    const args = getArguments();

    if (!args.has("force") && fs.existsSync(".temp") && fs.existsSync("lib")) 
    {
        console.log("prebuild skipped", packageJSON.name);
        return;
    }

    fs.rmSync("lib", { recursive: true, force: true });
    fs.rmSync(".temp", { recursive: true, force: true });
    await spawnCommand("tsc", ["--emitDeclarationOnly", "--declarationDir", "lib/ts-output"], process.cwd());
    fs.writeFileSync("lib/bundle.d.ts", "export * from './ts-output';", { encoding: "utf-8" });

    const esbuildInfo = await esbuild.build({
        entryPoints: ["src/index.ts"],
        bundle: true,
        outfile: "lib/bundle.js",
        minify: true,
        format: packageJSON.type === "module" ? "esm" : "cjs",
        platform: ["node"].includes(packageJSON.papit?.type ?? "node") ? "node" : "browser",
        external: externals,
    });

    if (esbuildInfo.errors.length > 0)
    {
        printState("prebuild js-bundle", "failed", packageJSON.name);

        if (args.has("error")) esbuildInfo.errors.forEach(message => console.log(message));
        process.exit(1);
    }
}());