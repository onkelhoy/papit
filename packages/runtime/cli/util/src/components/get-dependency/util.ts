import path from 'node:path';

import { getScope } from "../get-scope";
import { getLockfilePackagePath, LocalPackage, Lockfile, RemotePackages, RootPackage, } from "../get-package";
import { getJSON } from '../get-json';
import { Terminal } from '../terminal';
import { getPathInfo } from "../../util";


export type MinimalMap = { 
  changedversion?: boolean; 
  location?: string; 
  version?: string; 
  remoteversion?: string;
  dep: string[]; 
  has: string[]; 
  packagePriority?: number;
  layerPriority?: number;
  papit?: LocalPackage["papit"];
}
export type Config = {
  info: ReturnType<typeof getPathInfo>;
  scope: ReturnType<typeof getScope>;
  lockfile: Lockfile;
  rootPackage: RootPackage;
  acceptance?: Set<string>;
  data?: { map: Record<string, MinimalMap>, set: Set<string> }
  remotePackages?: RemotePackages|null;
  silent?: boolean;
};

export type Batch = {
  name: string;
  location: string | undefined;
  changedversion: boolean | undefined;
  version: string | undefined;
  remoteversion: string | undefined;
}

export function getBasicConfig(
  config: Partial<Config> = {}
): Config {
  const info = config.info ?? getPathInfo();
  const scope = config.scope ?? getScope();
  const rootPackage = config.rootPackage ?? getJSON<RootPackage>(path.join(info.root, "package.json"));
  if (!rootPackage)
  {
    Terminal.error("root package.json not found");
    process.exit(1);
  }

  const lockfile = config.lockfile ?? getJSON<Lockfile>(path.join(info.root, "package-lock.json"));

  if (!lockfile) 
  {
    Terminal.error("lockfile not found");
    process.exit(1);
  }

  return { ...config, info, scope, lockfile, rootPackage };
}

export function getPriority(
  pkg: LocalPackage,
  lockfile: Lockfile,
  root: RootPackage
) {
  const packagePath = getLockfilePackagePath(pkg.name, lockfile);
  if (!packagePath) return null;
  
  const layer = root.papit.layers[path.dirname(packagePath)];
  return {
    packagePriority: pkg.papit.priority,
    layerPriority: layer?.priority,
  }
}
