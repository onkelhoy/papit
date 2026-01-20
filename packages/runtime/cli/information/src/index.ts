// exports
export * from "./dependency";
export * from "./types";

import { Dependency } from "./dependency";

(async function () {
    const dep = new Dependency();
    const data = await dep.get("@papit/build");

    console.log("data", data?.tsconfig);
}())