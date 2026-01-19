import fs from "node:fs";
import path from "node:path";

export function findWorkspaceRoot(startDir: string): string {
  if (process.env.npm_config_local_prefix && isRoot(process.env.npm_config_local_prefix)) return process.env.npm_config_local_prefix;

  let dir = startDir;
  while (dir !== path.dirname(dir))
  { // stop at filesystem root
    if (isRoot(dir)) return dir; // found monorepo root

    dir = path.dirname(dir);
  }
  return startDir; // fallback
}

export function isRoot(dir: string) {
  if (!fs.existsSync(path.join(dir, "package.json"))) return false;

  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
  return !!pkg.workspaces;
}