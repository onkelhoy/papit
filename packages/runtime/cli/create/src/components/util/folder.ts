import { Terminal, RootPackage, getPathInfo, Arguments } from "@papit/util";
import fs from "node:fs";
import path from "node:path";

export function getFolders(dir: string): string[] {
  return fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isDirectory());
};

function getLayerFolders(
  dir: string,
  rootPackage: RootPackage,
  info: ReturnType<typeof getPathInfo>
): string[] {
  return fs.readdirSync(dir).filter(name => {
    const joined = path.join(dir, name);
    if (!fs.statSync(joined).isDirectory()) return false;
    const replaced = path.relative(info.root, joined);

    return !!rootPackage.papit.layers[replaced]
  });
};

export async function selectFolder(
  info: ReturnType<typeof getPathInfo> & { scope: string; },
  rootPackage: RootPackage,
) {
  return Terminal.sessionBlock(async () => {
    let target = path.join(info.root, "packages");
    const original = target;

    while (target)
    {
      const session = Terminal.createSession();
      const folders = getLayerFolders(target, rootPackage, info);

      Terminal.write("Current: ", target.replace(info.root, info.scope));
      Terminal.write();

      const option = await Terminal.option([["Choose Folder", "Create Folder"], target === original ? folders : ["..", ...folders]]);

      if (option.index === 0)
      {
        break;
      }
      if (option.index === 1)
      {
        const answer = await Terminal.prompt("folder name", false, target);
        const basename = path.basename(answer.input);

        const url = path.join(target, answer.input);
        const created = await createFolder(url, basename, info, rootPackage);

        if (created)
        {
          target = path.join(target, answer.input);
        }
      }
      else if (option.index === 2 && target !== original)
      {
        target = path.resolve(target, "..");
      }
      else 
      {
        target = path.join(target, folders[option.index - (target === original ? 2 : 3)]);
      }
      Terminal.clearSession(session);
    }

    return target;
  });
}


async function createFolder(
  url: string,
  name: string,
  info: ReturnType<typeof getPathInfo>,
  rootPackage: RootPackage,
) {
  Terminal.write(`[${url}]`);
  Terminal.write();
  Terminal.createSession();
  const shouldCreate = Arguments.args.flags.agree || await Terminal.confirm("confirm folder creation", true);
  Terminal.clearSession();

  if (!shouldCreate) return false;

  await createFolderConfig(url, name, info, rootPackage);

  return true;
}

export async function createFolderConfig(
  url: string,
  name: string,
  info: ReturnType<typeof getPathInfo>,
  rootPackage: RootPackage,
) {
  return Terminal.sessionBlock(async () => {
    const overrideName = await Terminal.prompt(`use "${name}" or override?`) || name;
    Terminal.clearSession();

    const prefixSuffix = ["false", "prefix", "suffix"];
    const mode = await Terminal.option(prefixSuffix, `include "${overrideName.input}" in packages`);

    if (!rootPackage.papit) rootPackage.papit = { layers: {} };
    const localFolder = path.relative(info.root, url);
    rootPackage.papit.layers[localFolder] = {
      include: mode.text === "false" ? false : mode.text as "prefix" | "suffix",
      name,
    }

    
    // its create new mode 
    fs.mkdirSync(url, { recursive: true, });
    fs.writeFileSync(path.join(info.root, "package.json"), JSON.stringify(rootPackage, null, 2), { encoding: "utf-8" });
  });
}