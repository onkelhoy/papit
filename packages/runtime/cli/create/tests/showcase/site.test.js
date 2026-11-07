import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeSite, describePackage } from "@papit/create";

let root, template, output, source;
const write = (file, content = "") => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};

before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-site-"));
    template = path.join(root, "template");
    output = path.join(root, "out");
    write(path.join(template, "index.html"), "<title>VARIABLE_TITLE</title>");
    write(path.join(root, "README.md"), "# root");

    const location = path.join(root, "packages", "web", "button");
    write(path.join(location, "views", "showcase", "index.html"), "<p>button</p>");
    write(path.join(location, "views", "showcase", "node_modules", "x.js"));
    write(path.join(location, "asset", "icons", "x.svg"), "<svg/>");
    write(path.join(location, "README.md"), "# button");
    write(path.join(location, "src", "index.ts"), "export {}");
    source = { name: "@x/button", location, packageJSON: { version: "1.0.0", papit: { type: "web-component" } } };

    write(path.join(output, "stale.txt"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("writeSite", () => {
    it("writes shell, manifest, readme and package files", () => {
        const entries = [describePackage(root, source, new Set())];
        const manifest = writeSite({ root, name: "x", version: "2.0.0", sources: [source], entries, template, output });

        const read = file => fs.readFileSync(path.join(output, file), "utf-8");
        assert.strictEqual(read("index.html"), "<title>x</title>");
        assert.strictEqual(read("README.md"), "# root");
        assert.strictEqual(read("packages/web/button/views/showcase/index.html"), "<p>button</p>");
        assert.strictEqual(read("packages/web/button/README.md"), "# button");
        assert.ok(fs.existsSync(path.join(output, "packages/web/button/asset/icons/x.svg")));

        assert.ok(!fs.existsSync(path.join(output, "stale.txt")), "output is emptied first");
        assert.ok(!fs.existsSync(path.join(output, "packages/web/button/src")), "sources are not copied");
        assert.ok(!fs.existsSync(path.join(output, "packages/web/button/views/showcase/node_modules")));

        assert.deepStrictEqual(JSON.parse(read("manifest.json")), manifest);
        assert.strictEqual(manifest.readme, true);
        assert.strictEqual(manifest.tree[0].children[0].package, "@x/button");
    });

    it("refuses an output that contains the workspace root", () => {
        assert.throws(() => writeSite({ root, name: "x", version: "1", sources: [], entries: [], template, output: path.dirname(root) }));
        assert.throws(() => writeSite({ root, name: "x", version: "1", sources: [], entries: [], template, output: root }));
    });
});
