const esbuild = require("esbuild");
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const packageJSON = require('../package.json');


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

const externals = [...Object.keys(packageJSON.dependencies || {}), ...Object.keys(packageJSON.peerDependencies || {})];

(async function () {

  fs.rmSync("lib", { recursive: true, force: true });
  await spawnCommand("tsc", ["--emitDeclarationOnly", "--declarationDir", "lib"], process.cwd());
  fs.writeFileSync("lib/index.d.ts", "export * from './src';", { encoding: "utf-8" });

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
    process.exit(1);
  }
}());