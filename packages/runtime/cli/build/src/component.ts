// import statements 
import path from "node:path";
import fs from "node:fs";
import {
  Arguments,
  DependencyBatch,
  LocalPackage,
  Package,
  Terminal,
  getDependencyBloodline,
  getDependencyOrder,
  getJSON,
  getModifiedTime,
  getPathInfo
} from "@papit/util";
import { BuildContext } from "esbuild";

import { getMeta, getMetaPath, saveMeta } from "./components/meta/get-meta";
import { jsBundler } from "./components/bundlers/js-bundle";
import { tsBundler } from "./components/bundlers/ts-bundle";
import { ExecutorOptions } from "./types";

const CACHED_PACKAGE_JSON: Record<string, LocalPackage> = {};
const PREBUILD_RUNS = new Set<string>();
const CONTEXTS: BuildContext[] = [];

export async function executor(options?: Partial<ExecutorOptions>) {
  if (Arguments.has("live")) Arguments.args.flags.dev = true;

  const mode = Arguments.args.flags.dev ? "dev" : "prod";
  const location = Arguments.args.flags.location;
  const originalinfo = getPathInfo(typeof location === "string" ? location : undefined);

  let buildMode = "individual";
  if (Arguments.has("all")) buildMode = "all";
  else if (Arguments.has("bloodline")) buildMode = "bloodline";
  else if (Arguments.has("ancestors")) buildMode = "ancestors";
  else if (Arguments.has("descendants")) buildMode = "descendants";

  if (Arguments.info)
  {
    Terminal.write("building mode:", Terminal.green(buildMode));
  }

  if (Arguments.has("live"))
  {
    process.on("SIGINT", () => {
      if (!Arguments.silent) Terminal.blue("live ended");

      CONTEXTS.forEach(ctx => {
        ctx.dispose()
      });
    });
  }

  switch (buildMode)
  {
    case "all":
      const { config, ...data } = await getDependencyOrder(
        async batch => await runPrebuild(batch, originalinfo),
        { info: originalinfo, silent: true }
      );

      if (PREBUILD_RUNS.size > 0)
      {
        await npmInstall(originalinfo);
      }

      await getDependencyOrder(
        async batch => await runBatch(batch, mode, originalinfo),
        { ...config, data, silent: false }
      );
      break;

    case "individual": {
      const packageJSON = getPackage(originalinfo.local);
      try 
      {
        const shouldinstall = await runner(mode, originalinfo, packageJSON, originalinfo);
        if (shouldinstall && !Arguments.args.flags['no-install']) await npmInstall(originalinfo);
      }
      catch (e)
      {
        console.log(e);
      }
      break;
    }
    case "bloodline":
    case "ancestors":
    case "descendants": {
      const packageJSON = getPackage(originalinfo.local);

      const { config, ...data } = await getDependencyBloodline(
        packageJSON.name,
        async batch => await runPrebuild(batch, originalinfo),
        { info: originalinfo, type: buildMode, silent: true }
      );

      if (PREBUILD_RUNS.size > 0)
      {
        await npmInstall(originalinfo);
      }

      await getDependencyBloodline(
        packageJSON.name,
        async batch => await runBatch(batch, mode, originalinfo),
        { ...config, data, silent: false }
      );
      break;
    }
  }
}

(async function () {
  if (Arguments.has("run")) await executor();
  else if (Arguments.debug) Terminal.write("@papit/build not in run mode")
}());

//#region functions 
function getPackage(local: string, name?: string) {
  if (CACHED_PACKAGE_JSON[local]) return CACHED_PACKAGE_JSON[local];

  const packageJSON = getJSON<LocalPackage>(path.join(local, "package.json"));
  if (!packageJSON)
  {
    Terminal.error(name ? `${name}'s package.json missing` : "package.json missing");
    throw new Error("package.json missing");
  }

  CACHED_PACKAGE_JSON[local] = packageJSON;
  return packageJSON;
}

async function runBatch(batch: DependencyBatch[], mode: "dev" | "prod", originalinfo: ReturnType<typeof getPathInfo>) {
  let shouldinstall = false;

  for (const b of batch) 
  {
    try 
    {
      const info = getPathInfo(b.location);
      const packageJSON = getPackage(info.local);
      const localinstall = await runner(mode, info, packageJSON, originalinfo);

      if (packageJSON.remoteVersion !== b.remoteversion && b.remoteversion !== undefined)
      {
        packageJSON.remoteVersion = b.remoteversion;
        fs.writeFileSync(path.join(info.local, "package.json"), JSON.stringify(packageJSON, null, 2), { encoding: "utf-8" });
        shouldinstall = true;
      }

      if (localinstall)
      {
        shouldinstall = true;
      }
    }
    catch (e)
    {
      if (Arguments.error)
      {
        console.log(e);
      }
    }
  }

  if (shouldinstall) await npmInstall(originalinfo);
}

async function npmInstall(originalinfo: ReturnType<typeof getPathInfo>) {

  if (!Arguments.args.flags.ci && !Arguments.args.flags['no-install'])
  {
    if (Arguments.verbose) console.log('running install');
    await Terminal.execute("npm install", originalinfo.root);
  }
  else if (Arguments.verbose)
  {
    console.log('no install');
  }
}

function getExportsInformation(entry: string, packageJSON: Package) {
  const { exports } = packageJSON;
  if (!exports) return null;
  if (typeof exports === "string") return { import: exports, types: null };
  if (entry === "bundle") entry = ".";

  const exportsEntry = exports[entry];
  if (!exportsEntry) return null;
  if (typeof exportsEntry === "string") return { import: exportsEntry, types: null };

  return exportsEntry;
}

async function runPrebuild(batch: DependencyBatch[], originalinfo: ReturnType<typeof getPathInfo>) {
  for (const b of batch) 
  {
    const info = getPathInfo(b.location);
    const packageJSON = getPackage(info.local);
    try 
    {
      if (!packageJSON.scripts?.prebuild) continue;
      if (!packageJSON.scripts?.bin) continue;
      if (info.local === originalinfo.local) continue;

      PREBUILD_RUNS.add(info.local);

      if (Arguments.verbose)
      {
        console.log(`${packageJSON.name} - running prebuild script`);
      }
      await Terminal.execute(packageJSON.scripts.prebuild, info.local);

      if (Arguments.verbose)
      {
        console.log(`${packageJSON.name} - running prebuild script`);
      }
    }
    catch (e)
    {
      if (Arguments.error) Terminal.error(packageJSON.name, "prebuild script failed")
    }
  }
}

async function runner(
  mode: "prod" | "dev",
  info: ReturnType<typeof getPathInfo>,
  packageJSON: LocalPackage,
  originalinfo: ReturnType<typeof getPathInfo>,
  options?: Partial<ExecutorOptions>,
) {
  const session = Terminal.createSession();
  if (!packageJSON.scripts?.build)
  {
    Terminal.warn(`${packageJSON.name} does not have build script defined - skipped`);
    return;
  }

  const hasMeta = fs.existsSync(path.join(info.package, `.temp/build-meta/${mode}.json`));
  const meta = await getMeta(mode, info, packageJSON);

  const src = path.join(info.package, path.basename(meta.tsconfig.info.srcFolder));
  const modifiedTime = getModifiedTime(src);
  if (
    !Arguments.has("force") &&
    !Arguments.has("live") &&
    !Arguments.has("ci") &&
    fs.existsSync(path.join(info.package, path.basename(meta.tsconfig.info.outDir))) &&
    hasMeta && // to make sure the outDir doesnt simply have a dev bundle or something (prebuild of util)
    modifiedTime === meta.lastModified
  )
  {
    return Terminal.write("📦", packageJSON.name, Terminal.blue("skipped"));
  }

  if (packageJSON.scripts.prebuild && info.local !== originalinfo.local && !PREBUILD_RUNS.has(info.local))
  {
    PREBUILD_RUNS.add(info.local);
    if (Arguments.debug)
    {
      console.log(`${packageJSON.name} - running prebuild script`);
    }
    await Terminal.execute(packageJSON.scripts.prebuild, info.local);

    if (Arguments.debug)
    {
      console.log(`${packageJSON.name} - running prebuild script`);
    }
  }

  if (Arguments.debug)
  {
    console.log("build-mode:", mode);
    console.log("package:", info.local);
    console.log("tsconfig:", meta.tsconfig.path);
    console.log("format:", packageJSON.type === "module" ? "esm" : "cjs");
    console.log("platform:", ["node"].includes(meta.config.type ?? "web-component") ? "node" : "browser");
    console.log();
  }

  if (meta.tsconfig.info.outDir && Arguments.has("clean"))
  {
    if (Arguments.debug)
    {
      console.log(`removing "${meta.tsconfig.info.outDir}"`)
    }
    fs.rmSync(meta.tsconfig.info.outDir, { recursive: true, force: true });
    fs.mkdirSync(meta.tsconfig.info.outDir, { recursive: true });
  }

  if (Arguments.has("live") && meta.entryPoints.keys.length > 1 && !Arguments.has("force"))
  {
    Terminal.error("you have multiple entry points in watch mode, consider using --force if its intentianal");
    process.exit(1);
  }

  let shouldinstall = false;
  for (const entryPointKey of meta.entryPoints.keys) 
  {
    const entryPoint = meta.entryPoints.record[entryPointKey];

    const exportsInformation = getExportsInformation(entryPointKey, packageJSON);
    let javascriptFileOutput = path.join(info.local, entryPoint.replace("src", "lib") + ".js");
    let typescriptFileOutput = path.join(info.local, entryPoint.replace("src", "lib") + ".d.ts");

    if (!exportsInformation) 
    {
      Terminal.warn(`"${entryPointKey}" does not exists in package.exports`);
    }
    else 
    {
      if (exportsInformation.import)
      {
        javascriptFileOutput = path.join(info.local, exportsInformation.import);
      }
      if (exportsInformation.types)
      {
        typescriptFileOutput = path.join(info.local, exportsInformation.types);
      }
    }

    let binEntry: string | null = null;
    if (packageJSON.bin)
    {
      for (const binEntryKey in packageJSON.bin)
      {
        let binValue = packageJSON.bin[binEntryKey];
        if (binValue.startsWith("./")) binValue = binValue.slice(1);
        if (javascriptFileOutput.endsWith(binValue))
        {
          binEntry = binEntryKey;
          break;
        }
      }
    }

    const absoluteEntry = entryPoint.startsWith(info.local) ? entryPoint : path.join(info.local, entryPoint);
    const absoluteTypesEntry = absoluteEntry.replace(info.local, path.join(info.local, ".temp/build")).replace(".ts", ".d.ts");
    if (Arguments.verbose)
    {
      Terminal.write(`• entryPoint "${Terminal.blue(entryPointKey)}"`);
      Terminal.write(`  ↳ (${Terminal.red("bundle")}) "${Terminal.blue(absoluteEntry.replace(info.local, ""))}" -> "${Terminal.green(javascriptFileOutput.replace(info.local, ""))}"`);
      Terminal.write(`  ↳ (${Terminal.red("types")}) "${Terminal.blue(absoluteTypesEntry.replace(info.local, ""))}" -> "${Terminal.green(typescriptFileOutput.replace(info.local, ""))}"\n`);
    }

    try
    {
      const result = await jsBundler(absoluteEntry, javascriptFileOutput, meta, info, packageJSON, options);
      if (result)
      {
        CONTEXTS.push(result as BuildContext);
      }

      await tsBundler(absoluteTypesEntry, typescriptFileOutput, meta, info);
    }
    catch (e)
    {
      Terminal.error(Terminal.red(packageJSON.name), 'build failed');
      if (Arguments.verbose)
      {
        console.log(e);
      }
      throw e;
    }

    if (binEntry)
    {
      if (Arguments.debug)
      {
        Terminal.write(Terminal.green('bin found'), binEntry, "\n");
      }
      // add shebang and remove from root/node_modeles/.bin
      if (!Arguments.args.flags.ci)
      {
        const rootNodeModuleBin = path.join(info.root, "node_modules/.bin", binEntry);
        if (fs.existsSync(rootNodeModuleBin)) 
        {
          fs.rmSync(rootNodeModuleBin);
        }
      }

      const bundle = fs.readFileSync(javascriptFileOutput, { encoding: "utf-8" });
      const updated = bundle.startsWith("#!/usr/bin/env node") ? bundle : `#!/usr/bin/env node\n${bundle}`;
      fs.writeFileSync(javascriptFileOutput, updated, { mode: 0o755 });
      shouldinstall = true;
    }
  }

  if (!Arguments.has("live") && !Arguments.verbose && !Arguments.debug && !Arguments.has("all") && !Arguments.has("bloodline") && !Arguments.has("ancestors") && !Arguments.has("descendants"))
  {
    Terminal.clearSession(session);
  }

  // save the modified time on successful run
  const location = getMetaPath(info, mode);
  meta.lastModified = modifiedTime;
  saveMeta(meta, location);

  Terminal.write("📦", packageJSON.name, Terminal.green("successfully built"), Arguments.has("live") ? Terminal.cyan("- watching") : "");
  return shouldinstall;
}
//#endregion