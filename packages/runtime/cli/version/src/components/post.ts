import path from "node:path";
import fs from "node:fs";
import { Arguments, getDependencyBloodline, getJSON, getPathInfo, LocalPackage, Lockfile, Terminal } from "@papit/util";

export async function post(packageJSON: LocalPackage, originalinfo: ReturnType<typeof getPathInfo>) {

  Arguments.args.flags.remote = true;
  Arguments.args.flags['include-root'] = true;
  Arguments.args.flags['include-dev'] = true;

  const updateDependencies = new Map<string, string>();
  updateDependencies.set(packageJSON.name, packageJSON.version);
  const lockfilepath = path.join(originalinfo.root, "temp-package-lock.json");
  const lockfile = getJSON<Lockfile>(lockfilepath);

  await getDependencyBloodline(
    packageJSON.name,
    async batch => {
      for (const b of batch) 
      {
        if (originalinfo.local === b.location) continue;
        const info = getPathInfo(b.location);
        const packageJSON = getJSON<LocalPackage>(path.join(info.local, "package.json"));
        if (!packageJSON)
        {
          Terminal.error(b.name ? `${b.name}'s package.json missing` : "package.json missing");
          throw new Error("package.json missing");
        }

        // we upgrade remote version if they dont match 
        if (packageJSON.remoteVersion !== b.remoteversion && b.remoteversion !== undefined)
        {
          packageJSON.remoteVersion = b.remoteversion;
        }

        // we do a patch if we need 
        if (!(b.changedversion || packageJSON.version !== packageJSON.remoteVersion))
        {
          const match = packageJSON.version.match(/^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?<semver>.*)$/);
          if (match?.groups)
          {
            const { major, minor, patch, semver } = match.groups;
            packageJSON.version = `${major}.${minor}.${Number(patch) + 1}${semver}`;
          }

          if (Arguments.info)
          {
            Terminal.write(Terminal.green(packageJSON.name), "version patch");
          }
        }

        for (const [name, version] of updateDependencies)
        {
          if (packageJSON.dependencies?.[name]) packageJSON.dependencies[name] = version;
          if (packageJSON.devDependencies?.[name]) packageJSON.devDependencies[name] = version;
          if (packageJSON.peerDependencies?.[name]) packageJSON.peerDependencies[name] = version;
        }

        updateDependencies.set(packageJSON.name, packageJSON.version);

        try 
        {
          fs.writeFileSync(path.join(info.local, "package.json"), JSON.stringify(packageJSON, null, 2), { encoding: "utf-8" });
        }
        catch (e)
        {
          Terminal.error(b.name, "version broke");
          if (Arguments.error)
          {
            console.log(e);
          }
        }
      }
    },
    { info: originalinfo, type: "descendants", lockfile: lockfile ?? undefined }
  );

  fs.renameSync(lockfilepath, path.join(originalinfo.root, "package-lock.json"));
}