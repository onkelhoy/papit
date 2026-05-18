export * from "./socket";
export * from "./server";
export * from "./types";

import { Arguments } from "@papit/arguments";

import { start } from "./server";

(async function () {
    if (!((Arguments.isCLI || Arguments.has("run")) && !process.env._?.endsWith("papit-signal-server"))) return;

    start();
}());