import path from "node:path";
import fs from "node:fs";

import { Information, LocalPackage } from "@papit/information";

import { copyFolder, getFolders } from "../util";
import { getName } from "../util/name";
import { option, Terminal } from "@papit/terminal";
import { Arguments } from "@papit/arguments";

type PackageInfo = {
    destination: string;
    nameInfo: ReturnType<typeof getName>;
    htmlprefix?: string;
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

// const Terminal.execute = promisify(exec);
export async function componentRunner(
    createPackageLocation: string,
    packageInfo?: PackageInfo,
) {

    const packageJSONLocation = Information.package.location; // path.join(info.local, "package.json");
    const _localPackage = Information.package.packageJSON; // getJSON<LocalPackage>(packageJSONLocation)

    if (_localPackage == null)
    {
        Terminal.error("could not find package's package.json file");
        process.exit(1);
    }

    if (_localPackage.name === Information.root.name) 
    {
        Terminal.error("cannot create a component to root");
        process.exit(1);
    }

    const localPackage = _localPackage as LocalPackage;

    const templateFolders = getFolders(path.join(createPackageLocation, "asset/component-templates"));
    const localRunnerSet = new Set<string>();
    try
    {
        getFolders(path.join(Information.root.location, "bin/runners/component"))
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
        const argType = Arguments.string("package") ?? Arguments.string("type");
        template.index = templateFolders.findIndex(f => f === argType);

        if (template.index < 0)
        {
            Terminal.createSession();
            Terminal.write("type of component");
            template = await Terminal.option(templateFolders);
            Terminal.clearSession();
        }
    }

    let htmlprefix = Arguments.string("html-prefix") ?? packageInfo?.htmlprefix ?? Information.package.packageJSON.papit.htmlprefix ?? Information.root.packageJSON.papit.htmlprefix;

    if (htmlprefix?.trim() === "") htmlprefix = undefined;

    if (htmlprefix === undefined && /web-components?/i.test(template.text))
    {
        const sess = Terminal.createSession();
        while (true)
        {
            let answer: string;
            if (htmlprefix !== undefined)
            {
                const ans = await Terminal.prompt(`use default "${htmlprefix}" or override?`);
                answer = ans.input;
                if (!answer) answer = htmlprefix;
            }
            else
            {
                const ans = await Terminal.prompt("html prefix", true);
                answer = ans.input;
            }

            if (answer)
            {
                htmlprefix = answer;
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

        let input = Arguments.string("name");
        if (!input) 
        {
            const ans = await Terminal.prompt("(component) name", true);
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
    const shouldCommit = packageInfo?.shouldCommit ?? Arguments.true('agree') ?? Arguments.true('commit') ?? await Terminal.confirm("git commit", true);
    Terminal.clearSession();

    const templateSrc = localRunnerSet.has(template.text) ? path.join(Information.root.location, "bin/runners/component", template.text) : path.join(createPackageLocation, "asset/component-templates", template.text);
    const folders = getFolders(templateSrc)

    localPackage.papit.components[nameInfo.name] = {
        className: nameInfo.className,
        htmlprefix: htmlprefix,
    }
    fs.writeFileSync(packageJSONLocation, JSON.stringify(localPackage, null, 2), { encoding: "utf-8" });
    if (shouldCommit)
    {
        await Terminal.execute(`git add ${packageJSONLocation}`, Information.root.location);
    }

    for (const folder of folders)
    {
        let destParent = path.join(Information.local, folder);
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
                .replace(/VARIABLE_HTML_NAME/g, `${htmlprefix}-${nameInfo.name}`)
                .replace(/VARIABLE_CLASS_NAME/g, nameInfo.className)
        });

        if (shouldCommit)
        {
            try
            {
                await Terminal.execute(`git add ${dest}`, Information.root.location);
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
        await Terminal.execute(`git commit -m "add: ${nameInfo.name} component"`, Information.root.location);
    }
}