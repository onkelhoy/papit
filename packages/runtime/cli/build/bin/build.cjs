const esbuild = require("esbuild");
const packageJSON = require('../package.json');

const externals = [...Object.keys(packageJSON.dependencies || {}), ...Object.keys(packageJSON.peerDependencies || {})];

(async function () {

  const esbuildInfo = await esbuild.build({
    entryPoints: ["./src/index.ts"],
    bundle: true,
    outfile: ".temp/bundle.js",
    minify: false,
    logLevel: "debug",
    format: "esm",
    platform: "node",
    external: externals,
  });

  if (esbuildInfo.errors.length > 0)
  {
    console.log("ERRORS", esbuildInfo.errors);
    process.exit(1);
  }
}());
