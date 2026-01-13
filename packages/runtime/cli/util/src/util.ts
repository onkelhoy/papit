import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

function findWorkspaceRoot(startDir: string): string {
  if (process.env.npm_config_local_prefix && isRoot(process.env.npm_config_local_prefix)) return process.env.npm_config_local_prefix;

  let dir = startDir;
  while (dir !== path.dirname(dir))
  { // stop at filesystem root
    if (isRoot(dir)) return dir; // found monorepo root

    dir = path.dirname(dir);
  }
  return startDir; // fallback
}

function isRoot(dir: string) {
  if (!fs.existsSync(path.join(dir, "package.json"))) return false;

  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
  return !!pkg.workspaces;
}


export function getPathInfo(location?: string, importurl?: string) {
  const local = location ?? process.cwd();

  let packageLocation = process.env.npm_package_json ? path.dirname(process.env.npm_package_json) : local;
  if (location)
  {
    packageLocation = location;
    while (!["/", ""].includes(packageLocation)) 
    {
      if (fs.existsSync(path.join(packageLocation, "package.json")))
        break;
      
      packageLocation = path.dirname(packageLocation);
    }
  }

  return {
    root: findWorkspaceRoot(local),
    package: packageLocation,
    local,
    script: getScriptPackageLocation(importurl),
  }
}

export function getScriptPackageLocation(url = import.meta.url) {
  const __filename = fileURLToPath(url);
  let __dirname = __filename;

  // get the parent folder of 'lib' if it ends with 'lib'
  for (let i = 0; i < 5; i++)
  {
    __dirname = dirname(__dirname);
    if (!fs.existsSync(join(__dirname, "package.json"))) continue;

    return __dirname;
  }

  return null;
}

