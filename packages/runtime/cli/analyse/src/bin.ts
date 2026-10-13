import path from "node:path";
import fs from "node:fs";

import { Args } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

import { analysePackage } from ".";

(async function () {
    const args = new Args(process.argv);
    const location = Information.package.location;
    const output = path.resolve(location, args.string("o") ?? "analyse.json");

    const analysis = analysePackage(location, { reuse: !args.has("no-reuse") });
    fs.writeFileSync(output, JSON.stringify(analysis, null, 2));

    Terminal.write(`analysed ${analysis.elements.length} element(s) → ${path.relative(process.cwd(), output)}`);
}())
