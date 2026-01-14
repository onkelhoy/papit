import path from 'node:path';
import fs from 'node:fs';

import { Arguments } from "../arguments";
import { getLockfilePackagePath, getRemotePackages, LocalPackage, RemotePackages, } from "../get-package";
import { Batch, Config, getBasicConfig, getPriority, MinimalMap } from './util';
import { Terminal } from '../terminal';
import { getJSON } from '../get-json';

// Function to initialize the package relationships

// info: ReturnType<typeof getPathInfo>,
// lockfile: Lockfile,
// scope = getScope(),
// acceptance?: Set<string>,
// remotePackages?: RemotePackages|null
export async function init({
  info,
  lockfile,
  scope,
  acceptance,
  remotePackages,
  rootPackage,
}: ReturnType<typeof getBasicConfig>) {

  const map: Record<string, MinimalMap> = {};
  const set = new Set<string>();

  for (const key in lockfile.packages)
  {
    if (!key.startsWith("packages")) continue;

    const pkg = getJSON<LocalPackage>(path.join(info.root, key, "package.json"));
    if (!pkg) continue;

    const name = pkg.name;
    let changedversion: boolean | undefined = undefined;

    if (!name.startsWith(scope)) continue;
    if (pkg.workspaces) continue;
    if (!Arguments.has('include-root') && name === `${scope}/root`) continue;
    if (acceptance && !acceptance.has(name)) continue;

    if (Arguments.has("remote"))
    {

      if (remotePackages)
      {
        const find = remotePackages.objects.find(p => p.package.name === pkg.name);
        if (find) 
        {
            changedversion = find.package.version !== pkg.version;
            if (!map[name]) map[name] = { dep: [], has: [], changedversion };
            map[name].remoteversion = find.package.version;

            if (!Arguments.has("ci"))
            {
                const location = getLockfilePackagePath(name, lockfile);
                if (location)
                {
                    const packagePATH = path.join(location, "package.json");
                    const packageJSON = getJSON<LocalPackage>(packagePATH);
                    if (packageJSON)
                    {
                        packageJSON.remoteVersion = find.package.version;
                        fs.writeFileSync(packagePATH, JSON.stringify(packageJSON, null, 2), "utf-8");
                    }
                }
            }
        }
        else 
        {
          changedversion = true;
        }
      }

      if (!changedversion && pkg.remoteVersion)
      {
        changedversion = pkg.remoteVersion === pkg.version;
      }
      else if (!remotePackages)
      {
        changedversion = true;
      }

      if (Arguments.verbose)
      {
        Terminal.write(Terminal.blue(`"${pkg.name}" version ${changedversion ? "changed" : "same"}`));
      }

      if (!changedversion && !Arguments.has('version-change')) 
      {
        continue;
      }
    }

    const location = path.join(info.root, key);

    if (!map[name]) map[name] = { dep: [], has: [], changedversion };

    set.add(name);

    const dependencies = [];

    map[name].location = location;
    map[name].version = pkg.version;
    const priority = getPriority(pkg, lockfile, rootPackage); // layer or package
    map[name].packagePriority = priority?.packagePriority;
    map[name].layerPriority = priority?.layerPriority;
    map[name].papit = pkg.papit;

    for (const dep in pkg.dependencies)
    {
      if (!dep.startsWith(scope) || dep === name) continue;

      if (!map[dep]) map[dep] = { dep: [], has: [] };
      map[dep].has.push(name);
      dependencies.push(dep);
    }

    for (const dep in pkg.peerDependencies)
    {
      if (!dep.startsWith(scope) || dep === name) continue;

      if (!map[dep]) map[dep] = { dep: [], has: [] };
      map[dep].has.push(name);
      dependencies.push(dep);
    }

    if (Arguments.args.flags['include-dev'])
    {
      for (const dep in pkg.devDependencies)
      {
        if (!dep.startsWith(scope) || dep === name) continue;

        if (!map[dep]) map[dep] = { dep: [], has: [] };
        map[dep].has.push(name);
        dependencies.push(dep);
      }
    }

    map[name].dep = dependencies;
  }

  return { map, set };
}

// Asynchronous generator function to yield batches of package names
export function* generator(
  { set, map }: Awaited<ReturnType<typeof init>>,
  silent?: boolean,
): Generator<Batch[], void, unknown> {

  function run(arr: string[], _set: Set<string>) {
    const list = [];
    for (const name of arr)
    {
      if (map[name].dep.length === 0 || map[name].packagePriority !== undefined)
      {
        _set.delete(name);
        set.delete(name);

        list.push({
          name,
          location: map[name].location,
          version: map[name].version,
          changedversion: map[name].changedversion,
          remoteversion: map[name].remoteversion,
        });
      }
    }

    if (list.length === 0) return null;

    for (const info of list)
    {
      // Remove this package as a dependency for the rest
      for (const other of map[info.name].has)
      {
        // we have to check if we have other in case we have filtered out some packages from the map in the version clensing step 
        if (map[other])
        {
          map[other].dep = map[other].dep.filter(n => n !== info.name);
        }
      }
    }

    return list;
  }

  const prioritySet = new Set<string>();
  for (const key of set)
  {
    if (map[key].layerPriority !== undefined || map[key].packagePriority !== undefined)
    {
      prioritySet.add(key);
    }
  }

  const printPriority = prioritySet.size > 0
  if (printPriority && Arguments.info && !silent) Terminal.write("priority batch");

  let hasprinted = false;
  while (prioritySet.size > 0)
  {
    const arr = Array
      .from(prioritySet)
      .sort((a, b) => {
        const aLayer = map[a].layerPriority ?? Number.MAX_SAFE_INTEGER;
        const bLayer = map[b].layerPriority ?? Number.MAX_SAFE_INTEGER;

        const layerDiff = aLayer - bLayer; // low first 

        if (layerDiff != 0) return layerDiff;
        
        const aPackage = map[a].packagePriority ?? Number.MAX_SAFE_INTEGER;
        const bPackage = map[b].packagePriority ?? Number.MAX_SAFE_INTEGER;

        return aPackage - bPackage; // low first
      });
    
    const batch = run(arr, prioritySet);

    if (!batch) break;

    if (Arguments.debug && !silent)
    {
      Terminal.write();
      Terminal.write(Terminal.yellow("priority batch"), `size=${batch.length}`);
    }
    yield batch;
  }

  if (printPriority && Arguments.info && !silent) Terminal.write();

  while (set.size > 0)
  {
    const arr = Array.from(set);
    const batch = run(arr, set);

    if (!batch) break;

    if (Arguments.debug && !silent) 
    {
      Terminal.write();
      Terminal.write(Terminal.yellow("package batch"), `size=${batch.length}`);
    }
    yield batch;
  }
}

export async function getDependencyOrder(
  executor: (batch: Batch[]) => Promise<void>,
  config: Partial<Config> = {},
) {
  const _config = getBasicConfig(config);
  // const { info, scope, lockfile, acceptance } = _config;
  let remotePackages: RemotePackages | null | undefined = config.remotePackages;
  if (Arguments.args.flags.remote && remotePackages === undefined)
  {
    if (Arguments.info)
    {
      Terminal.write("fetching remote-packages");
    }

    remotePackages = await getRemotePackages(_config.scope);
    _config.remotePackages = remotePackages;
  }

  const data = config.data ? config.data : await init(_config);
  const copyset = new Set(data.set);
  const copymap = JSON.parse(JSON.stringify(data.map)) as Record<string, MinimalMap>;

  for (const batch of generator(data, config.silent))
  {
    await executor(batch);
  }

  return {
    map: copymap,
    set: copyset,
    config: _config,
  };
}