import { getScope } from "../get-scope";
import { Lockfile, Package, RemotePackage, RemotePackages } from "./types";

export function getLockfilePackagePath(fullPackageName: string, lockfile: Lockfile): string | null {
  if (!lockfile) return null;

  const linkedPackage = lockfile.packages[`node_modules/${fullPackageName}`];
  if (!linkedPackage) return null;
  if (!('link' in linkedPackage)) throw Error("requested package is not local");

  return linkedPackage.resolved;
}
export function getPackage<T extends Package>(fullPackageName: string, lockfile: Lockfile): T | null {
  const path = getLockfilePackagePath(fullPackageName, lockfile);
  if (!path) return null;

  return lockfile.packages[path] as T;
}

export async function getRemotePackages(scope: string = getScope(), size: number = 100, from = 0): Promise<RemotePackages|null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${scope}&size=${size}&from=${from}`)
    if (!res.ok) return null;

    return await res.json() as RemotePackages;
  }
  catch 
  {
    return null;
  }
}

export async function getRemotePackage(packageName: string): Promise<RemotePackage|null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/%40papit%2Fcore${encodeURIComponent(packageName)}`)
    if (!res.ok) return null;
  
    return await res.json() as RemotePackage;
  }
  catch 
  {
    return null;
  }
}