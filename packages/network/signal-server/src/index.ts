export * from "./socket";
export * from "./server";
export * from "./types";

import { Arguments } from "@papit/util";
import { start } from "./server";

(async function() {
    if (Arguments.has("run") || process.env.npm_lifecycle_event === "npx")
    {
        start();
    }
}());