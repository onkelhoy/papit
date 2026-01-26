import path from "node:path";
import fs from "node:fs";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { copyFolder } from "../util";

export async function projectRunner(createPackageLocation: string) {
    Terminal.write("Project Creation\n")
    Terminal.createSession();
    let linebetween = false;
    let name = Arguments.string("name");

    if (name === undefined) {
        const answer = await Terminal.prompt("name", true);
        name = answer.input;
        linebetween = true;
    }

    let location = Arguments.string("location");

    if (location === undefined)
    {
        if (linebetween) Terminal.write();
        const answer = await Terminal.prompt("location");
        location = answer.path;
        linebetween = true;
    }

    await Terminal.sessionBlock(async () => {
        if (linebetween) Terminal.write();
        if (!fs.existsSync(location)) return;
        const canremove = await Terminal.confirm("confirm to remove it");
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


    if (linebetween) Terminal.write();
    const confirmcreatinglocation = await Terminal.confirm(Terminal.blue("confirm") + ` [${Terminal.yellow(location)}]`, true);
    if (!confirmcreatinglocation) 
    {

        Terminal.warn("abort");
        process.exit(0)
    }

    fs.mkdirSync(location, { recursive: true });

    let description = Arguments.string("description");
    if (description === undefined)
    {
        if (linebetween) Terminal.write();
        const ans = await Terminal.prompt("description");
        description = ans.input;
        linebetween = true;
    }

    let license = Arguments.string("license");
    if (license === undefined)
    {
        if (linebetween) Terminal.write();
        const ans = await Terminal.prompt("license (default MIT)");
        license = ans.input;
        linebetween = true;
    }

    if (license)
    {
        let licensefilelocation = Arguments.string("license-file-location");
        if (licensefilelocation === undefined)
        {
            if (linebetween) Terminal.write();
            const ans = await Terminal.prompt("license file location");
            licensefilelocation = ans.input;
            linebetween = true;
        }

        if (fs.existsSync(licensefilelocation)) 
        {
            fs.copyFileSync(licensefilelocation, path.join(location, 'LICENSE'));
        }
    }

    Terminal.clearSession();

    const initgit = Arguments.has("git") || await Terminal.confirm("init with git?");
    if (initgit)
    {
        await Terminal.execute("git init", { cwd: location });
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
}