import path from "node:path";
import fs from "node:fs";
import { Arguments, LocalPackage, Terminal, getJSON, getPackageTsconfig, getPathInfo, getScope } from "@papit/util";
import { getEntryPoints } from "./get-entrypoints";
import { Meta } from "./types";

export async function getMeta(
  mode: "prod" | "dev",
  info: ReturnType<typeof getPathInfo>,
  packageJSON: LocalPackage,
  tsconfig?: ReturnType<typeof getPackageTsconfig>,
) {
  const storedFile = getMetaPath(info, mode);
  if (fs.existsSync(storedFile) && !Arguments.args.flags.clean && !Arguments.args.flags.force) 
  {
    if (Arguments.debug) Terminal.write(Terminal.green('loading stored meta file'), storedFile);
    const json = getJSON<Meta>(storedFile);
    if (json !== null) return json;
  }

  const config: LocalPackage["papit"] = packageJSON.papit ?? {};

  const devTSconfig = path.join(info.package, "tsconfig.json");
  const prodTSconfig = path.join(info.package, "tsconfig.prod.json");

  let tsconfigFilePath = devTSconfig;
  if (mode === "prod" && fs.existsSync(prodTSconfig) && fs.statSync(prodTSconfig).isFile())
  {
    tsconfigFilePath = prodTSconfig;
  }

  if (!tsconfig) tsconfig = getPackageTsconfig(tsconfigFilePath);

  const tsConfigInfo = {
    declaration: Boolean(tsconfig.options.declaration),
    outDir: tsconfig.options.outDir ?? "lib",
    srcFolder: tsconfig.options.baseUrl ?? "src",
  };

  const entryPoints = getEntryPoints(info, packageJSON);
  const entryPointKeys = Object.keys(entryPoints);

  if (entryPointKeys.length === 0)
  {
    console.log({
      entryPoints,
      name: packageJSON.name,
      package: info.package
    })
    throw new Error("could not find any build entries");
  }

  let externals = [
    packageJSON.name,
    ...Object.keys(packageJSON.dependencies || {}),
    ...Object.keys(packageJSON.peerDependencies || {}),
  ];

  if (Arguments.args.flags['no-bundle'])
  {
    // externals = externals.filter(name => !name.startsWith(scope));
  }

  const meta: Meta = {
    entryPoints: {
      record: entryPoints,
      keys: entryPointKeys,
    },
    externals,
    tsconfig: {
      info: tsConfigInfo,
      path: tsconfigFilePath,
    },
    config,
  }

  saveMeta(meta, storedFile);
  return meta;
}

export function getMetaPath(info: ReturnType<typeof getPathInfo>, mode: "dev" | "prod") {
  return path.join(info.package, `.temp/build-meta/${mode}.json`);
}

export function saveMeta(meta: Meta, location: string) {
  if (Arguments.has("ci")) return;

  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, JSON.stringify(meta));
}