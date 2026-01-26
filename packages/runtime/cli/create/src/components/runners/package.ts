import path from "node:path";
import fs from "node:fs";


import { option, Terminal } from "@papit/terminal";
import { Information, LocalPackage, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";

import { componentRunner } from "./component";
import { copyFolder, getFolders, selectFolder } from "../util";
import { getName } from "../util/name";

export async function packageRunner(
    createPackageLocation: string,
) {
    const session = Terminal.createSession();

    // const Information.scope = getInformation.scope();

    const rootPackage = Information.root.packageJSON;
    if (rootPackage === null)
    {
        Terminal.error("root package.json not found");
        process.exit(1);
    }

    const layer = await selectFolder();

    const templateFolders = getFolders(path.join(createPackageLocation, "asset/package-templates/"));
    const localRunnerSet = new Set<string>();
    try
    {
        getFolders(path.join(Information.root.location, "bin/runners/package"))
            .forEach(f => {
                if (!fs.existsSync(path.join(Information.root.location, "bin/runners/package", f, "package.json"))) return;
                templateFolders.push(f);
                localRunnerSet.add(f);
            });
    }
    catch { }

    const argType = Arguments.string("package") ?? Arguments.string("type");
    let template: option = { index: templateFolders.findIndex(t => t === argType), text: "" };
    template.text = templateFolders[template.index];

    if (template.index < 0)
    {
        Terminal.write("type of package");
        template = await Terminal.option(templateFolders);
    }
    Terminal.clearSession();

    let htmlprefix = Arguments.string("html-prefix");
    if (htmlprefix?.trim() === "") htmlprefix = undefined;

    if (!htmlprefix && /web-components?/i.test(template.text))
    {
        if (!htmlprefix) htmlprefix = rootPackage.papit?.htmlprefix;

        Terminal.createSession();
        while (true) 
        {
            let answer: string;
            if (htmlprefix)
            {
                const ans = await Terminal.prompt(`use default "${htmlprefix}" or override?`);
                answer = ans.input;
                if (!answer) answer = htmlprefix;
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
                        rootPackage.papit.htmlprefix = answer;
                        fs.writeFileSync(path.join(Information.root.location, "package.json"), JSON.stringify(rootPackage, null, 2), { encoding: "utf-8" });
                    }
                }
            }

            if (answer) 
            {
                htmlprefix = answer;
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

    const localFolder = path.relative(Information.root.location, layer);

    const layerBasename = path.basename(layer);

    if (!rootPackage.repository?.url)
    {
        Terminal.error("root package.json does not have 'repository.url'");
        process.exit(1);
    }

    const repository = rootPackage.repository.url.replace(/\.git$/, '');
    const lockfile_location = path.join(Information.root.location, "package-lock.json");

    Terminal.clearSession(session); // this will also create session
    let nameInfo: ReturnType<typeof getName>;
    let fullName: string | undefined;
    while (fullName === undefined || nameInfo === undefined)
    {
        Terminal.clearSession();
        let input = Arguments.string("name");
        if (!input) 
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

        const combinedName = `${Information.scope}/${nameInfo.name}`;
        if (PackageGraph.get(combinedName))
        {
            Terminal.write("package already exists, try again")
        }
        else 
        {
            fullName = combinedName;
        }
    }

    let description = Arguments.string("description");
    if (!description) 
    {
        const ans = await Terminal.prompt("description", true);
        description = ans.input;
    }

    Terminal.write();
    Terminal.createSession();

    const destination = path.join(layer, nameInfo.name);

    // Copy package template
    const srcFolder = localRunnerSet.has(template.text) ? path.join(Information.root.location, "bin/runners/package", template.text) : path.join(createPackageLocation, "asset/package-templates", template.text);
    await copyFolder(srcFolder, destination, async (file, src) => {
        if (src.endsWith(".gitkeep")) return false;

        const final = file
            .replace(/VARIABLE_NAME/g, nameInfo.name)
            .replace(/VARIABLE_FULL_NAME/g, fullName)
            .replace(/VARIABLE_DESCRIPTION/g, description)
            .replace(/VARIABLE_LAYER_FOLDER/g, layerBasename)
            .replace(/VARIABLE_PROJECTLICENSE/g, rootPackage.license || "MIT")
            .replace(/VARIABLE_GITHUB_REPO/g, repository)
            .replace(/VARIABLE_LOCAL_DESTINATION/g, path.join(localFolder, nameInfo.name))
            .replace(/VARIABLE_CLASS_NAME/g, nameInfo.className)
            .replace(/VARIABLE_HTML_PREFIX/g, htmlprefix ?? "")
            .replace(/VARIABLE_HTML_NAME/g, `${htmlprefix}-${nameInfo.name}`)
            .replace(/VARIABLE_USER/g, process.env.USER ?? "anonymous");

        return final;
    });

    const localPackage = JSON.parse(fs.readFileSync(path.join(destination, "package.json"), { encoding: "utf-8" })) as LocalPackage;
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

    PackageGraph.add(destination); // we need to append to graph so component-runner can run smooth 

    Terminal.createSession();
    const shouldInstall = Arguments.true('agree') || Arguments.true('install') || await Terminal.confirm("install package", true);
    if (shouldInstall)
    {
        try
        {
            const { close } = Terminal.loading("installing");
            await Terminal.execute('npm install', description);
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

    const shouldCommit = Arguments.true('agree') || Arguments.true('commit') || await Terminal.confirm("git commit", true);

    await componentRunner(createPackageLocation, { destination, nameInfo, htmlprefix, shouldCommit });

    if (shouldCommit)
    {
        try
        {
            await Terminal.execute(`git add ${lockfile_location}`, destination);
            await Terminal.execute(`git add ${destination}`, destination);
            await Terminal.execute(`git commit -m "add: ${fullName} package"`, destination);
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