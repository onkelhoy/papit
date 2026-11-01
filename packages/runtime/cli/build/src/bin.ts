import { build } from ".";
import { Args } from "@papit/arguments";

(async function () {
    const args = new Args([...process.argv, "--can-print"]);
    const failed = await build(args);
    if (failed.size > 0) process.exitCode = 1;
}())
