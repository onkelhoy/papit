// import statements 
import path from "node:path";
import fs from "node:fs";
import { Arguments, Package, Terminal, getPathInfo } from "@papit/util";

function extractEntryPoint(value: string | string[] | Record<string, string>, outDir: string) {
  let entryPoints: Record<string, string> = {}
  if (typeof value === "string")
  {
    entryPoints.bundle = value; // default case
  }
  else if (Array.isArray(value))
  {
    for (const entry of value)
    {
      entryPoints[path.parse(entry).name] = entry;
    }
  }
  else 
  {
    entryPoints = { ...value };
  }

  for (const entry in entryPoints)
  {
    entryPoints[entry] = entryPoints[entry].replace(outDir, "src");
  }

  return entryPoints;
}
function mergeEntryPoints(
  currentEntryPoints: Record<string, string>,
  newEntryPoints: Record<string, string>,
  set: Set<string>,
) {
  for (let key in newEntryPoints)
  {
    // const { key, value } = parse(_key, newEntryPoints[_key]);
    const value = newEntryPoints[key];
    if (set.has(value)) 
    {
      if (Arguments.verbose) Terminal.warn(`entry "${key}" with its value was already defined`);
      continue;
    }

    set.add(value);

    if (currentEntryPoints[key] && currentEntryPoints[key] !== value)
    {
      Terminal.error("multiple entries found with different targets");
      process.exit(1);
    }

    currentEntryPoints[key] = value;
  }
}
export function getEntryPoints(
  info: ReturnType<typeof getPathInfo>,
  packageJSON: Package,
  outDir: string = "lib",
) {
  const entryPoints: Record<string, string> = {}
  const set = new Set<string>();

  if (Arguments.args.flags.entry && Arguments.args.flags.entry !== true)
  {
    mergeEntryPoints(entryPoints, extractEntryPoint(Arguments.args.flags.entry, outDir), set);
  }

  if (packageJSON.entryPoints)
  {
    mergeEntryPoints(entryPoints, extractEntryPoint(packageJSON.entryPoints, outDir), set);
  }

  if (packageJSON.exports)
  {
    const entryPointsValues: Record<string, string> = {};
    if (typeof packageJSON.exports === "string")
    {
      const trimmed = packageJSON.exports.replace(/^\.\//, '');
      entryPointsValues[packageJSON.exports] =packageJSON.exports.replace(/^\.\//, '').replace('.js', '.ts') ?? `src/${trimmed}.ts`;
    }
    else 
    {
      for (const entry in packageJSON.exports)
      {
        if (entry === ".") entryPointsValues.bundle = "src/index.ts";
        else 
        {
          const trimmed = entry.replace(/^\.\//, '');
          const value = typeof packageJSON.exports[entry] === "string" ? packageJSON.exports[entry] : packageJSON.exports[entry]?.import;
          if (!value) continue;
          entryPointsValues[entry] = value?.replace(/^\.\//, '').replace('.js', '.ts') ?? `src/${trimmed}.ts`;
        }
      }
    }

    mergeEntryPoints(entryPoints, extractEntryPoint(entryPointsValues, outDir), set);
  }

  if (packageJSON.bin)
  {
    mergeEntryPoints(entryPoints, extractEntryPoint(packageJSON.bin, outDir), set);
  }

  if (Object.keys(entryPoints).length === 0) 
  {
    entryPoints.bundle = path.join(info.package, "src/index.ts");
  }

  // now we should "fix" the entires to actual locations. we only check inside "src" flattly
  for (let key in entryPoints)
  {
    let entry = entryPoints[key].replace(/^(\.?\/)?(src\/)?/, '');
    if (fs.existsSync(entry)) 
    {
      const stat = fs.statSync(entry);
      if (stat.isFile()) continue;
      if (stat.isDirectory()) entry = path.join(entry, "index.ts");
    }
    const joined = path.join(info.package, "src", entry);

    if (fs.existsSync(joined) && fs.statSync(joined).isFile()) 
    {
      entryPoints[key] = joined;
    }
    else 
    {
      delete entryPoints[key];
    }
  }

  return entryPoints;
}