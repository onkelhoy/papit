import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

import { getPathInfo } from "../../util";
import { Arguments } from "../arguments";

export function getModifiedTime(location = "src") {
  // we need to check all files that contribute to changes 
  let highest = 0;

  const allFiles = fs.readdirSync(location, { recursive: true, encoding: "utf-8" });
  for (const name of allFiles)
  {
    const stat = fs.statSync(path.join(location, name));
    if (!stat.isFile()) continue;
    if (stat.mtimeMs > highest) highest = stat.mtimeMs;
  }

  return highest;
}

export function getPackageTsconfig(tsconfigPath: string) {

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error)
  {
    throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
  }

  return ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );
}

export function getPackageSourceFolder(info: ReturnType<typeof getPathInfo>, tsconfig: ts.ParsedCommandLine | null = null) {
  if (!tsconfig) tsconfig = getPackageTsconfig(path.join(info.package, Arguments.has("prod") ? "tsconfig.prod.json" : "tsconfig.json"));
  if (!tsconfig) throw new Error("could not establish tsconfig.json file");

  return tsconfig.options.baseUrl ?? "src";
}