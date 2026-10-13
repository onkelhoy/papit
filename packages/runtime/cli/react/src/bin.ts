import path from "node:path";

import { Args } from "@papit/arguments";
import { Information } from "@papit/information";
import { Terminal } from "@papit/terminal";

import { MARKER, writeReact } from ".";

(async function () {
    const args = new Args(process.argv);
    const location = Information.package.location;

    const result = writeReact(location, { output: args.string("o") });
    const file = path.relative(process.cwd(), result.file);

    if (result.status === "skipped")
    {
        Terminal.write(`${file} has no "${MARKER}" line, so it was taken over by hand and is left untouched`);
        return;
    }

    Terminal.write(`react wrappers → ${file}`);

    if (result.stale)
    {
        const stale = path.relative(process.cwd(), result.stale.file);
        if (result.stale.removed) Terminal.write(`removed ${stale}, which ${file} replaces`);
        else Terminal.warn(`${stale} has no "${MARKER}" line, so it is kept, but it shadows ${file}: bundle-js resolves .ts first`);
    }
}())
