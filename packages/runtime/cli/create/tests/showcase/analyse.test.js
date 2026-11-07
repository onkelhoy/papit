import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runAnalyse } from "@papit/create";

let root;
const pkg = (name, scripts) => {
    const location = path.join(root, name);
    fs.mkdirSync(location, { recursive: true });
    const packageJSON = { name, version: "1.0.0", scripts };
    fs.writeFileSync(path.join(location, "package.json"), JSON.stringify(packageJSON));
    return { name, location, packageJSON };
};

before(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-analyse-")); });
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("runAnalyse", () => {
    it("runs the analyse script where present and reports failures", async () => {
        const ok = pkg("ok", { analyse: "node -e \"require('fs').writeFileSync('analyse.json','{}')\"" });
        const broken = pkg("broken", { analyse: "node -e \"process.exit(3)\"" });
        const none = pkg("none", {});

        const failed = await runAnalyse([ok, broken, none], false);

        assert.deepStrictEqual(failed, ["broken"]);
        assert.ok(fs.existsSync(path.join(ok.location, "analyse.json")));
        assert.ok(!fs.existsSync(path.join(none.location, "analyse.json")));
    });
});
