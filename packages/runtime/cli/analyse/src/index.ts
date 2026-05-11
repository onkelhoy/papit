// exports

import path from "node:path";
import fs from "node:fs";

import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

(async function () {

    const srcFiles = fs.readdirSync(path.join(Information.package.location, Information.package.sourceFolder), { recursive: true });
    console.log(srcFiles)
}())
