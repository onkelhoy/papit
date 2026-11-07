import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describePackage, listViews, listFiles } from "@papit/create";

let root, location;
const write = (relative, content = "") => {
    const file = path.join(location, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};

before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "showcase-describe-"));
    location = path.join(root, "packages", "web", "atoms", "input");
    write("views/raw/index.html");
    write("views/showcase/index.html");
    write("views/experiment/index.html");
    write("views/tsconfig.json");
    write("views/no-index/main.js");
    write("README.md", "# input");
    write("asset/translations/en.json", "{}");
    write("asset/translations/sv.json", "{}");
    write("asset/icons/eye.svg", "<svg/>");
    write("asset/.gitkeep");
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("listViews", () => {
    it("lists folders with an index.html, showcase first", () => {
        assert.deepStrictEqual(listViews(location), ["showcase", "experiment", "raw"]);
    });

    it("keeps only filtered views, in filter order", () => {
        assert.deepStrictEqual(listViews(location, ["raw", "showcase"]), ["raw", "showcase"]);
    });

    it("returns [] without a views folder", () => {
        assert.deepStrictEqual(listViews(root), []);
    });
});

describe("listFiles", () => {
    it("walks recursively, skips dotfiles", () => {
        assert.deepStrictEqual(listFiles(path.join(location, "asset")), ["icons/eye.svg", "translations/en.json", "translations/sv.json"]);
    });
});

describe("describePackage", () => {
    it("builds the manifest entry", () => {
        const source = {
            name: "@x/input",
            location,
            packageJSON: { version: "1.2.3", description: "text input", papit: { type: "web-component" }, dependencies: { "@x/icon": "1.0.0", "left-pad": "1.0.0" } },
        };
        const entry = describePackage(root, source, new Set(["@x/icon", "@x/input"]));

        assert.deepStrictEqual(entry, {
            name: "@x/input",
            version: "1.2.3",
            description: "text input",
            type: ["web-component"],
            path: "web/atoms/input",
            views: ["showcase", "experiment", "raw"],
            readme: true,
            analyse: false,
            assets: ["icons/eye.svg", "translations/en.json", "translations/sv.json"],
            translations: ["en", "sv"],
            dependencies: ["@x/icon"],
        });
    });

    it("fills defaults for a bare package.json", () => {
        const entry = describePackage(root, { name: "@x/bare", location: path.join(root, "packages", "bare"), packageJSON: {} }, new Set());
        assert.strictEqual(entry.version, "0.0.0");
        assert.deepStrictEqual(entry.type, []);
        assert.strictEqual(entry.readme, false);
    });
});
