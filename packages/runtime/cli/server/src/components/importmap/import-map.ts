import path from "node:path";
import fs from "node:fs";
import { getPackage, getPathInfo, LocalPackage, Lockfile } from "@papit/util";
import { Importmap } from "./types";

export function extractImportmap(
  info: ReturnType<typeof getPathInfo>,
  packageJSON: LocalPackage, 
  lockfile: Lockfile|null,
  location: string,
  map: Importmap,
  mapFolder: string,
) {
  
  const append = (packagepath: string) => {
    const name = packageJSON.name;
    if (map.imports[name]) return;
    
    // NOTE, theres an inherit problem, - dependencies which are not 
    let destination:string;
    if (info.root !== info.local)
    {
        if (!fs.existsSync(packagepath)) return;
        destination = path.join(mapFolder, path.relative(info.root, packagepath));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(packagepath, destination);
    }
    else 
    {
      const packagePath = `node_modules/${name}`
      if (!lockfile?.packages[packagePath]) return;
      destination = packagePath;
    }

    map.imports[name] = "/" + path.relative(info.local, destination);
  }

  if (packageJSON.exports)
  {
    if (typeof packageJSON.exports === "string")
    {
      append(path.join(location, packageJSON.exports));
    }
    else 
    {
      for (const key in packageJSON.exports)
      {
        let name = packageJSON.name;
        if (key !== "." && key !== "default")
        {
            name += "/" + key;
        }

        const value = typeof packageJSON.exports[key] === "string" ? packageJSON.exports[key] : packageJSON.exports[key]?.import;
        if (!value) continue;
        
        append(path.join(location, value));
      }
    }
  }
  
  if (packageJSON.main)
  {
    append(path.join(location, packageJSON.main));
  }

  // we need to make sure any dependencies are added as well - but lets take this hit another time
  // if (lockfile)
  // {
  //   const dependencies = Object.keys(packageJSON.dependencies ?? {}).concat(Object.keys(packageJSON.peerDependencies ?? {}));
  //   for (const dep of dependencies)
  //   {
  //     const pkg = getPackage(dep, lockfile);
  //     // pkg.
  //   }
  // }
}