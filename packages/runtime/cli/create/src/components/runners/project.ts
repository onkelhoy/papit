import path from "node:path";
import fs from "node:fs";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { copyFolder } from "../util";

export async function projectRunner(createPackageLocation: string) {
    Terminal.write("Project Creation\n")
    Terminal.createSession();

    let name = Arguments.string("name");
    if (name === undefined)
    {
        const answer = await Terminal.prompt("name", true);
        name = answer.input;
    }

    let description = Arguments.string("description");
    if (description === undefined)
    {
        const ans = await Terminal.prompt("description", true);
        description = ans.input;
    }

    let location = Arguments.string("location");
    if (location === undefined)
    {
        const answer = await Terminal.prompt(process.cwd(), true, process.cwd());
        location = path.join(answer.path, name);
    }

    Terminal.write();

    Terminal.createSession();
    await Terminal.sessionBlock(async () => {
        if (!fs.existsSync(location)) return;

        const canremove = await Terminal.confirm(`confirm to remove it [${location}]`);
        if (canremove)
        {
            fs.rmSync(location, { recursive: true, force: true });
        }
        else 
        {
            Terminal.error("must choose a empty location");
            process.exit(1);
        }
    });

    const confirmcreatinglocation = await Terminal.confirm("confirm location" + ` [${Terminal.yellow(location)}]`, true);
    if (!confirmcreatinglocation) 
    {

        Terminal.warn("abort");
        process.exit(0)
    }

    fs.mkdirSync(location, { recursive: true });

    Terminal.clearSession();
    Terminal.write();
    let license = Arguments.string("license") ?? "MIT";

    if (license === undefined)
    {
        const ans = await Terminal.prompt("license (default MIT)");
        license = ans.input;
    }

    // if (license)
    // {
    //     let licensefilelocation = Arguments.string("license-file-location");
    //     if (licensefilelocation === undefined)
    //     {
    //         const ans = await Terminal.prompt("license file location");
    //         licensefilelocation = ans.input;
    //     }

    //     if (fs.existsSync(licensefilelocation)) 
    //     {
    //         fs.copyFileSync(licensefilelocation, path.join(location, 'LICENSE'));
    //     }
    // }

    Terminal.clearSession();

    const initgit = !Arguments.has("skip-git"); //  || await Terminal.confirm("init with git?");
    if (initgit)
    {
        const { close, update } = Terminal.loading("git init", 3000, frame => {
            if (frame > 400) update("runnign slow");
            else if (frame > 800) update("something seems wrong");
            else if (frame > 1500) update("yeah somethign is very wrong");
        })
        await Terminal.execute("git init", { cwd: location });

        Terminal.clearSession();
        close();
    }

    // Copy package template
    await copyFolder(path.join(createPackageLocation, "asset/project-template"), location, async (file, src) => {
        if (src.endsWith(".gitkeep")) return false;

        const final = file
            .replace(/VARIABLE_NAME/g, `@${name}/root`)
            .replace(/VARIABLE_DESCRIPTION/g, description)
            .replace(/VARIABLE_PROJECTLICENSE/g, license || "MIT")
            .replace(/VARIABLE_USER/g, process.env.USER ?? "anonymous");

        return final;
    });

    if (initgit)
    {
        await Terminal.execute("git add .", { cwd: location });
        await Terminal.execute(`git commit -m "init: ${name} initialized"`, { cwd: location });
    }

    const { close } = Terminal.loading("installing", 20000);
    await Terminal.execute("npm install", { cwd: location });
    close();

    Terminal.clearSession();

    Terminal.write();
    Terminal.write("project initialized");
    Terminal.write("try it:");
    Terminal.write(" (1)", Terminal.yellow(`cd ${location}`));
    Terminal.write(" (2)", Terminal.yellow("npm start"));

    process.exit(0);
}