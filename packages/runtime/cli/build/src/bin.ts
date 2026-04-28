import { build } from ".";
import { Args } from "@papit/arguments";

(async function () {
    await build(new Args([...process.argv, "--can-print"]));
}())