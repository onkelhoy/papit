import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import {
    getJSON,
    getScope,
    getPackage,
    copyFolder,
    Terminal,
    type Lockfile,
    getPathInfo,
    RootPackage,
    LocalPackage,
    Arguments,
    option,
} from "@papit/util"
import { componentRunner } from "./component";

import { createFolderConfig, getFolders, selectFolder } from "../util";
import { getName } from "../util/name";

const execAsync = promisify(exec);

export async function packageRunner(
    info: ReturnType<typeof getPathInfo>,
) {
    const session = Terminal.createSession();

    const scope = getScope();

    const rootPackage = getJSON<RootPackage>(path.join(info.root, "package.json"));
    if (rootPackage === null)
    {
        Terminal.error("root package.json not found");
        process.exit(1);
    }

    const layer = await selectFolder(
        {
            ...info,
            scope,
        },
        rootPackage,
    );

    const templateFolders = getFolders(path.join(info.script!, "asset/package-templates/"));
    const localRunnerSet = new Set<string>();
    try
    {
        getFolders(path.join(info.root, "bin/runners/package"))
            .forEach(f => {
                if (!fs.existsSync(path.join(info.root, "bin/runners/package", f, "package.json"))) return;
                templateFolders.push(f);
                localRunnerSet.add(f);
            });
    }
    catch { }

    const argType = Arguments.args.flags.package ?? Arguments.args.flags.type;
    let template: option = { index: templateFolders.findIndex(t => t === argType), text: "" };
    template.text = templateFolders[template.index];

    if (template.index < 0)
    {
        Terminal.write("type of package");
        template = await Terminal.option(templateFolders);
    }
    Terminal.clearSession();

    let htmlPrefix: string | undefined = undefined;
    if (Array.isArray(Arguments.args.flags['html-prefix'])) htmlPrefix = Arguments.args.flags['html-prefix'].join("-");
    else if (typeof Arguments.args.flags['html-prefix'] === "string") htmlPrefix = Arguments.args.flags['html-prefix'];
    if (htmlPrefix?.trim() === "") htmlPrefix = undefined;

    if (!htmlPrefix && /web-components?/i.test(template.text))
    {
        // const rootConfig = getConfig(path.join(info.root, ".config"));

        if (!htmlPrefix) htmlPrefix = rootPackage.papit?.htmlprefix;

        Terminal.createSession();
        while (true) 
        {
            let answer: string;
            if (htmlPrefix)
            {
                const ans = await Terminal.prompt(`use default "${htmlPrefix}" or override?`);
                answer = ans.input;
                if (!answer) answer = htmlPrefix;
            }
            else 
            {
                const ans = await Terminal.prompt("html prefix", true);
                answer = ans.input;

                if (!rootPackage.papit?.htmlprefix)
                {
                    const setasroot = await Terminal.confirm(`you wish to set "${answer}" as the default html-prefix?`);
                    if (setasroot)
                    {
                        if (!rootPackage.papit) rootPackage.papit = { layers: {} };
                        rootPackage.papit.htmlprefix = answer;
                        fs.writeFileSync(path.join(info.root, "package.json"), JSON.stringify(rootPackage, null, 2), { encoding: "utf-8" });
                    }
                }
            }

            if (answer) 
            {
                htmlPrefix = answer;
                break;
            }
            else 
            {
                Terminal.clearSession();
                Terminal.warn("you must use a html-prefix for web-components")
            }
        }
        Terminal.clearSession();
    }

    const localFolder = path.relative(info.root, layer);

    const layerBasename = path.basename(layer);
    let layerConfig = rootPackage.papit.layers[localFolder]

    if (!layerConfig)
    {
        Terminal.warn(".config file is missing");
        await createFolderConfig(layer, layerBasename, info, rootPackage); // this will update "layerConfig" thanks to JS strong by reference 
    }

    if (!rootPackage.repository?.url)
    {
        Terminal.error("root package.json does not have 'repository.url'");
        process.exit(1);
    }

    const repository = rootPackage.repository.url.replace(/\.git$/, '');
    const lockfile_location = path.join(info.root, "package-lock.json");

    let lockfile = getJSON<Lockfile>(lockfile_location);
    if (lockfile === null)
    {
        await execAsync('npm install');
        lockfile = getJSON<Lockfile>(lockfile_location);
    }

    Terminal.clearSession(session); // this will also create session
    let nameInfo: ReturnType<typeof getName>;
    while (true)
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
        if (lockfile && getPackage(`${scope}/${nameInfo.name}`, lockfile))
        {

            Terminal.write("package already exists, try again")
            continue;
        }

        break;
    }

    const fullName = `${scope}/${layerConfig.include === "prefix" ? layerConfig.name + "-" : ""}${nameInfo.name}${layerConfig.include === "suffix" ? "-" + layerConfig.name : ""}`;
    let description = Array.isArray(Arguments.args.flags.description) ? Arguments.args.flags.description.join(" ") : Arguments.args.flags.description;
    if (!description || description === true) 
    {
        const ans = await Terminal.prompt("description", true);
        description = ans.input;
    }

    Terminal.write();
    Terminal.createSession();

    const destination = path.join(layer, nameInfo.name);

    // Copy package template
    await copyFolder(localRunnerSet.has(template.text) ? path.join(info.root, "bin/runners/package", template.text) : path.join(info.script!, "asset/package-templates", template.text), destination, async (file, src) => {
        if (src.endsWith(".gitkeep")) return false;

        const final = file
            .replace(/VARIABLE_NAME/g, nameInfo.name)
            .replace(/VARIABLE_FULL_NAME/g, fullName)
            .replace(/VARIABLE_DESCRIPTION/g, description)
            .replace(/VARIABLE_LAYER_FOLDER/g, layerBasename)
            .replace(/VARIABLE_LAYER_NAME/g, layerConfig.name ?? layerBasename)
            .replace(/VARIABLE_PROJECTLICENSE/g, rootPackage.license || "MIT")
            .replace(/VARIABLE_GITHUB_REPO/g, repository)
            .replace(/VARIABLE_LOCAL_DESTINATION/g, path.join(localFolder, nameInfo.name))
            .replace(/VARIABLE_CLASS_NAME/g, nameInfo.className)
            .replace(/VARIABLE_HTML_PREFIX/g, htmlPrefix ?? "")
            .replace(/VARIABLE_HTML_NAME/g, `${htmlPrefix}-${nameInfo.name}`)
            .replace(/VARIABLE_USER/g, process.env.USER ?? "anonymous");

        return final;
    });

    const localPackage = getJSON<LocalPackage>(path.join(destination, "package.json"));
    if (!localPackage)
    {
        Terminal.error(`package.json not found at "${destination}"`);
        process.exit(1);
    }

    if (!localPackage.papit)
    {
        localPackage.papit = {
            main: nameInfo.name,
            components: {},
            publish: true,
            type: template.text,
        }
    }

    Terminal.createSession();
    const shouldInstall = 'agree' in Arguments.args.flags || 'install' in Arguments.args.flags || await Terminal.confirm("install package", true);
    if (shouldInstall)
    {
        try
        {
            const { close } = Terminal.loading("installing");
            await execAsync('npm install');
            close();
            Terminal.clearSession();
        }
        catch
        {
            Terminal.warn("error during install");
        }
    }
    else 
    {
        Terminal.clearSession();
    }

    const shouldCommit = 'agree' in Arguments.args.flags || 'commit' in Arguments.args.flags || await Terminal.confirm("git commit", true);

    await componentRunner(info, { destination, nameInfo, htmlPrefix, shouldCommit });

    if (shouldCommit)
    {
        try
        {
            await execAsync(`git add ${lockfile_location}`);
            await execAsync(`git add ${destination}`);
            await execAsync(`git commit -m "add: ${fullName} package"`);
            Terminal.clearSession();
        }
        catch
        {
            Terminal.warn("error during commit");
        }
    }
    else 
    {
        Terminal.clearSession();
    }

    Terminal.write(`${fullName} created\n`);

}