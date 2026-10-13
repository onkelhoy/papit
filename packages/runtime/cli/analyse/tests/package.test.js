import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { analysePackage } from "@papit/analyse";

const repo = (relative) => fileURLToPath(new URL(`../../../../${relative}`, import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const bin = fileURLToPath(new URL("../lib/bin.js", import.meta.url));

/** Writes `files` (relative path → content) under `root`. */
function write(root, files) {
    for (const [file, content] of Object.entries(files))
    {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
}
const setTime = (file, seconds) => fs.utimesSync(file, seconds, seconds);
const tsconfig = { compilerOptions: { baseUrl: "src", outDir: "lib" }, include: ["src"] };
const packageJSON = (name) => ({ name, version: "1.0.0", type: "module", main: "./lib/bundle.js" });

describe("analysePackage on @papit/switch", () => {
    const get = () => analysePackage(repo("web/design-system/atoms/switch")).elements.find(e => e.className === "Switch");

    it("lists the defined element with its package-relative source", () => {
        const element = get();
        assert.strictEqual(element?.tagName, "pap-switch");
        assert.deepStrictEqual(element.source, { package: "@papit/switch", file: "src/component.ts" });
    });

    it("resolves extends through the engine down to HTMLElement", () => {
        const internals = get().extends;
        assert.strictEqual(internals?.className, "CustomElementInternals");
        assert.strictEqual(internals.source.package, "@papit/web-component");
        assert.strictEqual(internals.extends?.className, "CustomElement");
        assert.deepStrictEqual(internals.extends.extends, { builtin: "HTMLElement" });
    });

    it("keeps inherited members on the parent Core", () => {
        assert.ok(get().extends.properties.some(p => p.name === "disabled"));
    });
});

describe("analysePackage reuse", () => {
    let root;
    let base;
    let app;
    const marker = "from analyse.json";
    const shipped = { name: "@papit/shipped", version: "1.0.0", elements: [{ className: "Shipped", description: marker, source: { package: "@papit/shipped", file: "src/shipped.ts" }, properties: [], methods: [], events: [], states: [], html: { slots: [], parts: [] }, css: { variables: [] }, extends: { builtin: "HTMLElement" } }] };
    const stored = { ...shipped, name: "@papit/fixture-base", elements: [{ ...shipped.elements[0], className: "Base", source: { package: "@papit/fixture-base", file: "src/base.ts" } }] };

    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "papit-"));
        base = path.join(root, "base");
        app = path.join(root, "app");

        write(base, {
            "package.json": packageJSON("@papit/fixture-base"),
            "tsconfig.json": tsconfig,
            "src/index.ts": `export * from "./base";`,
            "src/base.ts": `/** Analysed from source. */\nexport class Base extends HTMLElement {}`,
            "analyse.json": stored,
        });
        write(app, {
            "package.json": packageJSON("@papit/fixture-app"),
            "tsconfig.json": tsconfig,
            "src/index.ts": `import { App, Other, Lost } from "./component";\nexport * from "./component";\ncustomElements.define("fixture-app", App);\ncustomElements.define("fixture-other", Other);\ncustomElements.define("fixture-lost", Lost);`,
            "src/component.ts": [
                `import { Base } from "@papit/fixture-base";`,
                `import { Shipped } from "@papit/shipped";`,
                `import { Missing } from "@papit/missing";`,
                `export class App extends Base {}`,
                `export class Other extends Shipped {}`,
                `export class Lost extends Missing {}`,
            ].join("\n"),
            "node_modules/@papit/shipped/package.json": packageJSON("@papit/shipped"),
            "node_modules/@papit/shipped/analyse.json": shipped,
        });
        fs.symlinkSync(base, path.join(app, "node_modules/@papit/fixture-base"), "dir");
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    const element = (name, options) => analysePackage(app, options).elements.find(e => e.className === name);

    it("reuses an in-repo analyse.json newer than its src", () => {
        for (const file of ["src/index.ts", "src/base.ts", "package.json"]) setTime(path.join(base, file), 1_000);
        setTime(path.join(base, "analyse.json"), 2_000);
        assert.strictEqual(element("App").extends.description, marker);
    });

    it("re-analyses when src is newer than analyse.json", () => {
        setTime(path.join(base, "analyse.json"), 1_000);
        setTime(path.join(base, "src/base.ts"), 2_000);
        assert.strictEqual(element("App").extends.description, "Analysed from source.");
    });

    it("re-analyses a fresh analyse.json when reuse is off", () => {
        setTime(path.join(base, "src/base.ts"), 1_000);
        setTime(path.join(base, "analyse.json"), 2_000);
        assert.strictEqual(element("App", { reuse: false }).extends.description, "Analysed from source.");
    });

    it("always reuses a shipped analyse.json in node_modules", () => {
        setTime(path.join(app, "node_modules/@papit/shipped/analyse.json"), 1);
        assert.strictEqual(element("Other").extends.description, marker);
    });

    it("keeps a Reference for a parent it can't resolve", () => {
        assert.deepStrictEqual(element("Lost").extends, { className: "Missing", import: "@papit/missing" });
    });

    it("fills tagName from customElements.define in the entry file", () => {
        assert.strictEqual(element("App").tagName, "fixture-app");
    });
});

describe("papit-analyse bin", () => {
    let root;
    let location;

    before(() => {
        // realpath: on macOS the tmp dir is a symlink, and PWD must match the cwd the graph resolves
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
        location = path.join(root, "packages/fixture");
        write(root, { "package.json": { name: "@tmp/root", private: true, workspaces: ["packages/*"] } });
        write(location, {
            "package.json": packageJSON("@tmp/fixture"),
            "tsconfig.json": tsconfig,
            "src/index.ts": `import { Fixture } from "./component";\nexport * from "./component";\ncustomElements.define("pap-fixture", Fixture);`,
            "src/component.ts": fs.readFileSync(path.join(fixtures, "basic/component.ts"), "utf8"),
            "src/style.css": fs.readFileSync(path.join(fixtures, "basic/style.css"), "utf8"),
        });
    });
    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it("writes the analysis to the -o file", () => {
        const env = { ...process.env, PWD: location };
        delete env.npm_config_local_prefix;

        const result = spawnSync(process.execPath, [bin, "-o", "out.json"], { cwd: location, env, encoding: "utf8" });
        assert.strictEqual(result.status, 0, result.stderr);

        const written = JSON.parse(fs.readFileSync(path.join(location, "out.json"), "utf8"));
        assert.strictEqual(written.name, "@tmp/fixture");
        assert.deepStrictEqual(written.elements.map(e => [e.className, e.tagName]), [["Fixture", "pap-fixture"]]);
        assert.ok(!fs.existsSync(path.join(location, "analyse.json")));
    });
});

describe("analysePackage resolved types", () => {
    /** Union members, sorted: the checker's member order isn't the source order. */
    const members = (type) => type?.split(" | ").sort();
    const property = (core, name) => {
        for (let current = core; current?.properties; current = current.extends)
        {
            const found = current.properties.find(p => p.name === name);
            if (found) return found;
        }
    };

    it("resolves @papit/button's color alias", () => {
        const button = analysePackage(repo("web/design-system/1-foundations/button")).elements.find(e => e.className === "Button");
        const color = property(button, "color");
        assert.strictEqual(color?.type, "ButtonColor");
        assert.ok(members(color.resolvedType)?.includes("\"primary\""), color.resolvedType);
        assert.ok(!members(color.resolvedType).includes("ButtonColor"), color.resolvedType);
    });

    it("resolves @papit/tabs' orientation, indexed into a class from another package", () => {
        const tabs = analysePackage(repo("web/design-system/atoms/tabs")).elements.find(e => e.className === "Tabs");
        const orientation = property(tabs, "orientation");
        assert.strictEqual(orientation?.type, "Group[\"orientation\"]");
        assert.deepStrictEqual(members(orientation.resolvedType), ["\"horizontal\"", "\"vertical\""]);
    });
});
