import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import {
  Terminal,
  copyFolder,
  getPathInfo,
  getJSON,
  RootPackage,
  LocalPackage,
  Arguments,
  option,
} from "@papit/util"
import { getFolders } from "../util";
import { getName } from "../util/name";

type PackageInfo = {
  destination: string;
  nameInfo: ReturnType<typeof getName>;
  htmlPrefix?: string;
  shouldCommit: boolean;
}

function folderHasFilesSync(path: string): boolean {
  try
  {
    return fs.readdirSync(path).length > 0;
  } catch
  {
    return false;
  }
}
function createFolderIfNotExistSync(url: string) {
  if (!(fs.existsSync(url) && fs.statSync(url).isDirectory()))
  {
    fs.mkdirSync(url);
  }
}

const execAsync = promisify(exec);
export async function componentRunner(
  _info: ReturnType<typeof getPathInfo>,
  packageInfo?: PackageInfo,
  rootPackage?: RootPackage,
) {

  const info = getPathInfo(packageInfo?.destination);

  if (!rootPackage) rootPackage = getJSON<RootPackage>(path.join(info.root, "package.json")) ?? undefined;
  if (!rootPackage)
  {
    Terminal.error("could not find root package.json file");
    process.exit(1);
  }

  const packageJSONLocation = path.join(info.local, "package.json");
  const localPackage = getJSON<LocalPackage>(packageJSONLocation)

  if (localPackage == null)
  {
    Terminal.error("could not find package's package.json file");
    process.exit(1);
  }

  const templateFolders = getFolders(path.join(_info.script!, "asset/component-templates"));
  const localRunnerSet = new Set<string>();
  try
  {
    getFolders(path.join(info.root, "bin/runners/component"))
      .forEach(f => {
        templateFolders.push(f);
        localRunnerSet.add(f);
      });
  }
  catch { }

  let template: option = { index: templateFolders.findIndex(f => f === localPackage.papit?.type), text: "" };
  template.text = templateFolders[template.index];

  if (template.index < 0)
  {
    const argType = Arguments.args.flags.component ?? Arguments.args.flags.type;
    template.index = templateFolders.findIndex(f => f === argType);

    if (template.index < 0)
    {
      Terminal.createSession();
      Terminal.write("type of component");
      template = await Terminal.option(templateFolders);
      Terminal.clearSession();
    }
  }

  let htmlPrefix: string | undefined = undefined;
  if (Array.isArray(Arguments.args.flags['html-prefix'])) htmlPrefix = Arguments.args.flags['html-prefix'].join("-");
  else if (typeof Arguments.args.flags['html-prefix'] === "string") htmlPrefix = Arguments.args.flags['html-prefix'];
  else htmlPrefix = packageInfo?.htmlPrefix ?? rootPackage.papit.htmlprefix;

  if (htmlPrefix?.trim() === "") htmlPrefix = undefined;

  if (htmlPrefix === undefined && /web-components?/i.test(template.text))
  {
    if (htmlPrefix === undefined) htmlPrefix = localPackage.papit.htmlprefix;

    const sess = Terminal.createSession();
    while (true)
    {
      let answer: string;
      if (htmlPrefix !== undefined)
      {
        const ans = await Terminal.prompt(`use default "${htmlPrefix}" or override?`);
        answer = ans.input;
        if (!answer) answer = htmlPrefix;
      }
      else
      {
        const ans = await Terminal.prompt("html prefix", true);
        answer = ans.input;
      }

      if (answer)
      {
        htmlPrefix = answer;
        break;
      }
      else
      {

        Terminal.clearSession();
        Terminal.write("you must use a html-prefix for web-components")
      }
    }
    Terminal.clearSession(sess);
  }

  let nameInfo: ReturnType<typeof getName> = packageInfo?.nameInfo;
  while (!nameInfo)
  {
    Terminal.clearSession();

    let input: string | undefined = undefined;
    if (Array.isArray(Arguments.args.flags.name)) input = Arguments.args.flags.name.join(" ");
    else if (typeof Arguments.args.flags.name === "string") input = Arguments.args.flags.name;
    else 
    {
      const ans = await Terminal.prompt("(package) name", true);
      input = ans.input;
    }

    nameInfo = getName(input);

    if (!nameInfo)
    {
      Terminal.write("name missing, try again");
      continue;
    }

    if (localPackage.papit.components[nameInfo.name])
    {
      Terminal.write("name already exist, try again");
      continue;
    }

    break;
  }

  Terminal.createSession();
  const shouldCommit = packageInfo?.shouldCommit === undefined ? ('agree' in Arguments.args.flags || 'commit' in Arguments.args.flags || await Terminal.confirm("git commit", true)) : packageInfo.shouldCommit;
  Terminal.clearSession();

  console.log({template})
  const templateSrc = localRunnerSet.has(template.text) ? path.join(info.root, "bin/runners/component", template.text) : path.join(_info.script!, "asset/component-templates", template.text);
  const folders = getFolders(templateSrc)

  localPackage.papit.components[nameInfo.name] = {
    className: nameInfo.className,
    htmlprefix: htmlPrefix,
  }
  fs.writeFileSync(packageJSONLocation, JSON.stringify(localPackage, null, 2), { encoding: "utf-8" });
  if (shouldCommit)
  {
    await execAsync(`git add ${packageJSONLocation}`);
  }

  for (const folder of folders)
  {
    let destParent = path.join(info.local, folder);
    let dest = destParent;
    const templateFolderSrc = path.join(templateSrc, folder);

    if (folder === "src")
    {
      if (folderHasFilesSync(destParent))
      {
        destParent = path.join(destParent, "components");
        dest = path.join(destParent, nameInfo.name);
      }
      // else -> we keep dest as destParent
    }
    else
    {
      dest = path.join(destParent, nameInfo.name);
    }
    createFolderIfNotExistSync(destParent);

    await copyFolder(templateFolderSrc, dest, file => {
      return file
        .replace(/VARIABLE_NAME/g, nameInfo.name)
        .replace(/VARIABLE_FULL_NAME/g, localPackage.name)
        .replace(/VARIABLE_HTML_NAME/g, `${htmlPrefix}-${nameInfo.name}`)
        .replace(/VARIABLE_CLASS_NAME/g, nameInfo.className)
    });

    if (shouldCommit)
    {
      try
      {
        await execAsync(`git add ${dest}`);
      }
      catch
      {
        Terminal.warn(`"git add ${dest}" failed`);
      }
    }
  }

  // its not in package -> component mode
  if (!packageInfo?.shouldCommit && shouldCommit)
  {
    await execAsync(`git commit -m "add: ${nameInfo.name} component"`);
  }
}