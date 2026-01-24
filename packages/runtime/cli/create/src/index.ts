// exports

import path from "node:path";
import fs from "node:fs";

import { Arguments } from "@papit/arguments";
import { Information, LocalPackage, PackageGraph } from "@papit/information";
import { Terminal, option } from "@papit/terminal";

import { packageRunner } from "./components/runners/package";
import { componentRunner } from "./components/runners/component";
import { getFolders } from "./components/util";
import { projectRunner } from "./components/runners/project";

(async function () {
    Arguments.init(process.argv, ["install", "commit", "agree"])

    if (Arguments.verbose)
    {
        process.env.verbose = "true";
    }

    const createPackageLocation = path.dirname(import.meta.dirname);
    const CREATE_PACKAGE = JSON.parse(fs.readFileSync(path.join(createPackageLocation, "package.json"), { encoding: "utf-8" })) as LocalPackage;

    // const  = PackageGraph.get("@papit/create");
    if (!CREATE_PACKAGE)
    {
        Terminal.error("could not find @papit/create package.json");
        process.exit(1);
    }

    if (!process.env.USER)
    {
        Terminal.createSession();
        const ans = await Terminal.prompt("your name", true);
        process.env.USER = ans.input;
        Terminal.clearSession();
    }

    Terminal.write();
    Terminal.write("@papit/create", Terminal.yellow(CREATE_PACKAGE.version), "- running");
    Terminal.write();

    const localRunnerSet = new Set<string>();
    const localRunnersLocation = path.join(Information.root.location, "bin/runners");
    const options = ["package", "component", "project", "showcase"];
    try
    {
        const folders = getFolders(localRunnersLocation);
        folders.forEach(folder => {
            if (options.includes(folder)) return;

            const runnerFile = path.join(localRunnersLocation, folder, "runner.js");
            if (!fs.existsSync(runnerFile)) return;

            localRunnerSet.add(folder);
            options.push(folder);
        });
    }
    catch { }


    let option: option | null = null;
    for (let i = 0; i < options.length; i++)
    {
        if (Arguments.has(options[i])) 
        {
            option = { index: i, text: options[i] };
            break;
        }
    }

    if (option === null)
    {
        Terminal.createSession();
        option = await Terminal.option(options);
        Terminal.clearSession();
    }

    switch (option.index)
    {
        case 0:
            await packageRunner(createPackageLocation);
            break;
        case 1:
            await componentRunner(createPackageLocation);
            break;
        case 2:
            await projectRunner(createPackageLocation);
            break;
        default: {
            if (!localRunnerSet.has(option.text))
            {
                Terminal.error("requested a runner that doesnt exist");
                process.exit(1);
            }

            const runnerFile = path.join(localRunnersLocation, option.text, "runner.js");

            if (Arguments.verbose)
            {
                Terminal.write(`running local runner "${option.text}"`);
            }

            const { default: runner } = await import(runnerFile);
            await runner();
            break;
        }
    }

    process.exit();
}())
