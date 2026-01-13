import { getPackage, LocalPackage } from "../get-package";
import { Terminal } from "../terminal";
import { Arguments } from "../arguments";

import { getDependencyOrder, init } from "./order";
import { Batch, Config, getBasicConfig } from "./util";

export async function getDependencyBloodline(
  packageName: string, 
  executor:(batch: Batch[]) => Promise<void>, 
  config: Partial<Config & { type: "ancestors"|"descendants"|"bloodline" }> = {}
) {
  const type = config.type ?? "bloodline";
  
  if (config.data && config.acceptance)
  {
    return getDependencyOrder(executor, config);
  }
    
  const meta = getBasicConfig(config);
  const bloodline = new Set<string>();
  if (["bloodline", "ancestors"].includes(type)) ancestorsRecursive(packageName, meta, bloodline);
  if (["bloodline", "descendants"].includes(type)) 
  {
    const data = await init(meta);
    descendantsRecursive(packageName, data, bloodline);
  }

  return getDependencyOrder(executor, { ...meta, acceptance: bloodline });
}

// helper functions 
function ancestorsRecursive(packageName: string, config: Config, set: Set<string>) {
  if (set.has(packageName)) return;
  if (packageName === config.lockfile.name) return;

  const pkg = getPackage<LocalPackage>(packageName, config.lockfile);
  if (!pkg)
  {
    Terminal.error(`package "${packageName}" not found`);
    process.exit(1);
  }

  set.add(packageName);

  for (const dep in pkg.dependencies) {
    if (!dep.startsWith(config.scope) || dep === packageName) continue;
    ancestorsRecursive(dep, config, set);
  }

  for (const dep in pkg.peerDependencies) {
    if (!dep.startsWith(config.scope) || dep === packageName) continue;
    ancestorsRecursive(dep, config, set);
  }

  if (Arguments.args.flags['include-dev'])
  {
    for (const dep in pkg.devDependencies) {
      if (!dep.startsWith(config.scope) || dep === packageName) continue;
      ancestorsRecursive(dep, config, set);
    }
  }
}

function descendantsRecursive(
  packageName: string, 
  data: Awaited<ReturnType<typeof init>>,
  set: Set<string>
) {
  if (set.has(packageName)) return;

  if (!data.map[packageName]) 
  {
    Terminal.error(`package "${packageName}" not found`);
    process.exit(1);
  }

  set.add(packageName);

  for (const dec of data.map[packageName].has) 
  {
    descendantsRecursive(dec, data, set);
  }
}