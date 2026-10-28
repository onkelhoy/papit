import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../lib/bin.js");

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

function pkg(name, extra = {}) {
    return { name, version: "0.0.1", type: "module", ...extra };
}

const TSCONFIG = { compilerOptions: { outDir: "lib", rootDir: "src", target: "es2022", module: "esnext", moduleResolution: "bundler" }, include: ["src"] };

function page(title, script = "main.js") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <title>${title}</title>
    <link rel="stylesheet" href="style.css" />
    <script type="module" src="${script}"></script>
</head>
<body class="demo">
    <h1>${title}</h1>
</body>
</html>`;
}

/**
 * Workspace: @fake/app depends on @fake/base and on fake-ext from node_modules (which depends
 * on fake-sub), plus (dev) @fake/theme and @playwright/test. @fake/base and fake-ext both ship
 * an icons/shared.svg that @fake/app also ships, so precedence shows.
 */
function createWorkspace() {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
    write(path.join(root, "package.json"), { name: "@fake/root", private: true, workspaces: ["packages/*"] });

    const base = path.join(root, "packages", "base");
    write(path.join(base, "package.json"), pkg("@fake/base", {
        main: "./lib/bundle.js",
        exports: { ".": { import: "./lib/bundle.js" } },
        papit: { type: "web-component" },
    }));
    write(path.join(base, "tsconfig.json"), TSCONFIG);
    write(path.join(base, "src", "index.ts"), "export const base = 1;\n");
    write(path.join(base, "lib", "bundle.js"), "export const base = 1;\n");
    write(path.join(base, "asset", "icons", "shared.svg"), "<svg>base</svg>");
    write(path.join(base, "asset", "icons", "base-only.svg"), "<svg>base-only</svg>");
    write(path.join(base, "asset", "translations", "en.json"), { meta: { language: "fx", region: "FX" }, base: "base", shared: "from base" });

    const theme = path.join(root, "packages", "theme");
    write(path.join(theme, "package.json"), pkg("@fake/theme", { exports: { ".": "./lib/theme.css" }, papit: { type: "theme" } }));
    write(path.join(theme, "tsconfig.json"), TSCONFIG);
    write(path.join(theme, "lib", "theme.css"), ":root { --fake: 1; }\n");

    const modules = path.join(root, "node_modules");
    write(path.join(modules, "fake-ext", "package.json"), pkg("fake-ext", { main: "dist/index.js", dependencies: { "fake-sub": "1.0.0" } }));
    write(path.join(modules, "fake-ext", "dist", "index.js"), `import "fake-sub";\nexport const ext = 1;\n`);
    write(path.join(modules, "fake-ext", "asset", "sounds", "ding.mp3"), "ding");
    write(path.join(modules, "fake-ext", "asset", "icons", "shared.svg"), "<svg>ext</svg>");
    write(path.join(modules, "fake-sub", "package.json"), pkg("fake-sub", { exports: "./index.js" }));
    write(path.join(modules, "fake-sub", "index.js"), "export const sub = 1;\n");
    write(path.join(modules, "@playwright", "test", "package.json"), pkg("@playwright/test", { main: "index.js" }));
    write(path.join(modules, "@playwright", "test", "index.js"), "export {};\n");

    const app = path.join(root, "packages", "app");
    write(path.join(app, "package.json"), pkg("@fake/app", {
        main: "./lib/bundle.js",
        dependencies: { "@fake/base": "0.0.1", "fake-ext": "1.0.0" },
        devDependencies: { "@fake/theme": "0.0.1", "@playwright/test": "1.0.0" },
        papit: { type: "web-component" },
    }));
    write(path.join(app, "tsconfig.json"), TSCONFIG);
    write(path.join(app, "src", "index.ts"), "export const app = 1;\n");
    write(path.join(app, "lib", "bundle.js"), `import "@fake/base";\n`);
    write(path.join(app, "asset", "icons", "shared.svg"), "<svg>app</svg>");
    write(path.join(app, "asset", "translations", "en.json"), { meta: { language: "fx", region: "FX" }, app: "app", shared: "from app" });

    // views/app: the default page folder (package name without scope)
    const view = path.join(app, "views", "app");
    write(path.join(view, "index.html"), page("App page"));
    write(path.join(view, "main.js"), `import "@fake/app";\nimport "fake-ext";\nimport { HELPER } from "./helper.js";\nconsole.log(HELPER);\n`);
    write(path.join(view, "helper.js"), `export const HELPER = "helper-marker";\n`);
    write(path.join(view, "style.css"), `@import "@fake/theme";\nh1 { color: red; }\n`);
    write(path.join(view, "extra.css"), `@import "reset.css";\n@import "@nobody/thing";\n`);
    write(path.join(view, "reset.css"), "* { margin: 0; }\n");
    write(path.join(view, "sub", "index.html"), page("Sub page"));
    write(path.join(view, "public", "icons", "view.svg"), "<svg>view</svg>");

    // views/other: picked with --target other; its script is TypeScript
    const other = path.join(app, "views", "other");
    write(path.join(other, "index.html"), page("Other page", "main.ts"));
    write(path.join(other, "main.ts"), `const n: number = 1;\nexport const OTHER = "other-marker-" + n;\nconsole.log(OTHER);\n`);
    write(path.join(other, "style.css"), "h1 { color: blue; }\n");

    write(path.join(app, "tests", "app", "index.html"), page("Test page"));

    return { root, app, base, view, other };
}

function run(cwd, ...args) {
    const env = { ...process.env, PWD: cwd };
    delete env.npm_config_local_prefix; // npm test points this at the real repo
    return spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: "utf-8" });
}

function read(file) {
    return fs.readFileSync(file, "utf-8");
}

function importmapOf(html) {
    const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    assert.ok(match, "page has an import map");
    return JSON.parse(match[1]);
}

describe("papit-static CLI, default page folder", () => {
    let ws, out, result;

    before(() => {
        ws = createWorkspace();
        out = path.join(ws.root, "out");
        result = run(ws.app, "--output", out, "--base", "/papit/");
    });

    after(() => {
        fs.rmSync(ws.root, { recursive: true, force: true });
    });

    it("exits cleanly", () => {
        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
    });

    it("writes .nojekyll", () => {
        assert.ok(fs.existsSync(path.join(out, ".nojekyll")));
    });

    describe("page folder", () => {
        it("publishes views/<package short name> at the output root", () => {
            assert.ok(fs.existsSync(path.join(out, "index.html")));
            assert.ok(fs.existsSync(path.join(out, "sub", "index.html")));
        });

        it("publishes neither tests/ nor the other views", () => {
            assert.ok(!fs.existsSync(path.join(out, "tests")));
            assert.ok(!fs.existsSync(path.join(out, "views")));
            assert.ok(!fs.existsSync(path.join(out, "other")));
        });

        it("leaves the page folder's asset folder to public/", () => {
            assert.strictEqual(read(path.join(out, "public", "icons", "view.svg")), "<svg>view</svg>");
        });
    });

    describe("public/", () => {
        it("lets the closest package win a shared path", () => {
            assert.strictEqual(read(path.join(out, "public", "icons", "shared.svg")), "<svg>app</svg>");
        });

        it("skips the duplicates instead of writing them elsewhere", () => {
            const icons = fs.readdirSync(path.join(out, "public", "icons")).sort();
            assert.deepStrictEqual(icons, ["base-only.svg", "shared.svg", "view.svg"]);
        });

        it("keeps assets only an ancestor ships", () => {
            assert.strictEqual(read(path.join(out, "public", "icons", "base-only.svg")), "<svg>base-only</svg>");
        });

        it("merges translations per language", () => {
            const json = JSON.parse(read(path.join(out, "public", "translations", "fx.json")));
            assert.strictEqual(json.base, "base");
            assert.strictEqual(json.app, "app");
            assert.strictEqual(json.shared, "from app");
            assert.strictEqual(json.meta.language, "fx");
        });

        it("copies the asset folders of node_modules packages", () => {
            assert.strictEqual(read(path.join(out, "public", "sounds", "ding.mp3")), "ding");
        });
    });

    describe("lib/", () => {
        it("copies the built output of every workspace import map entry", () => {
            assert.strictEqual(read(path.join(out, "lib", "@fake", "base", "lib", "bundle.js")), "export const base = 1;\n");
            assert.ok(fs.existsSync(path.join(out, "lib", "@fake", "app", "lib", "bundle.js")));
        });

        it("copies the theme", () => {
            assert.ok(fs.existsSync(path.join(out, "lib", "@fake", "theme", "lib", "theme.css")));
        });

        it("copies node_modules packages, transitively", () => {
            assert.ok(fs.existsSync(path.join(out, "lib", "fake-ext", "dist", "index.js")));
            assert.ok(fs.existsSync(path.join(out, "lib", "fake-sub", "index.js")));
        });

        it("leaves dev and test tooling out", () => {
            assert.ok(!fs.existsSync(path.join(out, "lib", "@playwright")));
        });
    });

    describe("pages", () => {
        let html;
        before(() => {
            html = read(path.join(out, "index.html"));
        });

        it("uses the page's title, not the template's", () => {
            assert.strictEqual(html.match(/<title>(.*?)<\/title>/)[1], "App page");
        });

        it("keeps the page content", () => {
            assert.match(html, /<h1>App page<\/h1>/);
            assert.match(html, /class="demo"/);
        });

        it("injects the import map rewritten to --base + lib/", () => {
            const map = importmapOf(html);
            assert.strictEqual(map.imports["@fake/base"], "/papit/lib/@fake/base/lib/bundle.js");
            assert.strictEqual(map.imports["@fake/app"], "/papit/lib/@fake/app/lib/bundle.js");
            assert.strictEqual(map.imports["fake-ext"], "/papit/lib/fake-ext/dist/index.js");
            assert.strictEqual(map.imports["fake-sub"], "/papit/lib/fake-sub/index.js");
            assert.strictEqual(map.imports["@playwright/test"], undefined);
            assert.ok(!html.includes(ws.root), "no absolute filesystem path leaks into the page");
        });

        it("places the import map before the first module script", () => {
            assert.ok(html.indexOf(`type="importmap"`) < html.indexOf(`src="main.js"`));
        });

        it("injects no theme link", () => {
            assert.ok(!/<link[^>]*lib\/@fake\/theme/.test(html));
        });

        it("has no live-reload script", () => {
            assert.ok(!html.includes("templates/live"));
            assert.ok(!html.includes("WebSocket"));
            assert.ok(!html.includes("liveservererrorpopup"));
        });

        it("maps the root-absolute asset URLs onto public/", () => {
            assert.ok(html.includes(`"/en.json":"/papit/public/translations/fx.json"`));
            assert.ok(html.includes(`"/icons/shared.svg":"/papit/public/icons/shared.svg"`));
        });

        it("points a package @import at its copy in lib/", () => {
            assert.strictEqual(read(path.join(out, "style.css")), `@import "/papit/lib/@fake/theme/lib/theme.css";\nh1 { color: red; }\n`);
        });

        it("leaves a local file and an unknown name alone, warning about the unknown one", () => {
            assert.strictEqual(read(path.join(out, "extra.css")), `@import "reset.css";\n@import "@nobody/thing";\n`);
            const log = result.stdout + result.stderr;
            assert.ok(log.includes("@nobody/thing"), log);
            assert.ok(log.includes("extra.css"), log);
            assert.ok(!log.split("\n").some(line => line.includes("warn") && line.includes("reset.css")), log);
        });
    });

    describe("page scripts", () => {
        let script;
        before(() => {
            script = read(path.join(out, "main.js"));
        });

        it("bundles relative imports in", () => {
            assert.ok(script.includes("helper-marker"));
            assert.ok(!script.includes("./helper.js"));
        });

        it("keeps package imports external for the import map", () => {
            assert.match(script, /["']@fake\/app["']/);
            assert.match(script, /["']fake-ext["']/);
        });

        it("minifies", () => {
            assert.ok(script.trim().split("\n").length <= 2, script);
        });
    });

    it("removes the working folder the server creates", () => {
        assert.ok(!fs.existsSync(path.join(ws.app, ".temp")));
    });
});

describe("papit-static CLI, --target and errors", () => {
    let ws;

    before(() => { ws = createWorkspace(); });
    after(() => { fs.rmSync(ws.root, { recursive: true, force: true }); });

    it("--target picks views/<target> and compiles a .ts page script to .js", () => {
        const out = path.join(ws.root, "out-other");
        const result = run(ws.app, "--target", "other", "--output", out);

        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
        const html = read(path.join(out, "index.html"));
        assert.match(html, /<title>Other page<\/title>/);
        assert.match(html, /src="main.js"/);
        assert.ok(read(path.join(out, "main.js")).includes("other-marker-"));
        assert.ok(!fs.existsSync(path.join(out, "main.ts")));
    });

    it("defaults --base to /", () => {
        const out = path.join(ws.root, "out-base");
        const result = run(ws.app, "--output", out);

        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
        const map = importmapOf(read(path.join(out, "index.html")));
        assert.strictEqual(map.imports["@fake/base"], "/lib/@fake/base/lib/bundle.js");
    });

    it("defaults --output to ./dist", () => {
        const result = run(ws.app);

        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
        assert.ok(fs.existsSync(path.join(ws.app, "dist", "index.html")));
        fs.rmSync(path.join(ws.app, "dist"), { recursive: true, force: true });
    });

    it("uses the .html files in the cwd", () => {
        const out = path.join(ws.root, "out-cwd");
        const result = run(ws.other, "--output", out);

        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
        assert.match(read(path.join(out, "index.html")), /<title>Other page<\/title>/);
    });

    it("fails on a missing --target, naming the folders it tried", () => {
        const result = run(ws.app, "--target", "nope", "--output", path.join(ws.root, "x"));

        assert.notStrictEqual(result.status, 0);
        assert.ok((result.stderr + result.stdout).includes(path.join(ws.app, "views", "nope")));
    });

    it("fails without a page folder, naming the folders it tried", () => {
        const result = run(ws.base, "--output", path.join(ws.root, "y"));

        assert.notStrictEqual(result.status, 0);
        assert.ok((result.stderr + result.stdout).includes(path.join(ws.base, "views", "github")));
        assert.ok(!fs.existsSync(path.join(ws.root, "y")));
    });

    it("refuses to write into the page folder", () => {
        const result = run(ws.other, "--output", ".");

        assert.notStrictEqual(result.status, 0);
        assert.ok(!fs.existsSync(path.join(ws.other, ".nojekyll")));
    });
});

describe("papit-static CLI, app outside any workspace", () => {
    let root, out, result, html;

    before(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));
        const modules = path.join(root, "node_modules");

        write(path.join(root, "package.json"), pkg("@acme/app", { dependencies: { "@papit/theme": "1.0.0", "acme-widget": "1.0.0" } }));
        write(path.join(root, "tsconfig.json"), TSCONFIG);
        write(path.join(root, "src", "index.ts"), "export {};\n");

        write(path.join(modules, "@papit", "theme", "package.json"), pkg("@papit/theme", { exports: { ".": "./lib/theme.css", "./dark.css": "./lib/dark.css" } }));
        write(path.join(modules, "@papit", "theme", "lib", "theme.css"), `@import "./tokens.css";\n:root { --theme: 1; }\n`);
        write(path.join(modules, "@papit", "theme", "lib", "tokens.css"), ":root { --token: 1; }\n");
        write(path.join(modules, "@papit", "theme", "lib", "dark.css"), `@import "@papit/theme";\n`);

        write(path.join(modules, "acme-widget", "package.json"), pkg("acme-widget", { exports: { ".": { import: "./dist/index.js" } } }));
        write(path.join(modules, "acme-widget", "dist", "index.js"), "export const widget = 1;\n");
        write(path.join(modules, "acme-widget", "asset", "icons", "widget.svg"), "<svg>widget</svg>");

        const site = path.join(root, "views", "github");
        write(path.join(site, "index.html"), page("Acme"));
        write(path.join(site, "main.js"), `import { widget } from "acme-widget";\nconsole.log(widget);\n`);
        write(path.join(site, "style.css"), `@import "@papit/theme";\n@import url("@papit/theme/dark.css") (prefers-color-scheme: dark);\nbody { margin: 0; }\n`);

        out = path.join(root, "out");
        result = run(root, "--output", out, "--base", "/papit/");
        html = result.status === 0 ? read(path.join(out, "index.html")) : "";
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it("exits cleanly", () => {
        assert.strictEqual(result.status, 0, result.stderr + result.stdout);
    });

    it("points the import map at lib/", () => {
        const map = importmapOf(html);
        assert.strictEqual(map.imports["acme-widget"], "/papit/lib/acme-widget/dist/index.js");
        assert.ok(fs.existsSync(path.join(out, "lib", "acme-widget", "dist", "index.js")));
    });

    it("copies the theme package into lib/ and points the page @import at it", () => {
        assert.ok(fs.existsSync(path.join(out, "lib", "@papit", "theme", "lib", "theme.css")));
        assert.strictEqual(
            read(path.join(out, "style.css")),
            `@import "/papit/lib/@papit/theme/lib/theme.css";\n@import url("/papit/lib/@papit/theme/lib/dark.css") (prefers-color-scheme: dark);\nbody { margin: 0; }\n`,
        );
    });

    it("rewrites @imports inside copied lib/ stylesheets, leaving relative ones", () => {
        assert.strictEqual(read(path.join(out, "lib", "@papit", "theme", "lib", "theme.css")), `@import "./tokens.css";\n:root { --theme: 1; }\n`);
        assert.strictEqual(read(path.join(out, "lib", "@papit", "theme", "lib", "dark.css")), `@import "/papit/lib/@papit/theme/lib/theme.css";\n`);
    });

    it("copies the JS package's assets into public/", () => {
        assert.strictEqual(read(path.join(out, "public", "icons", "widget.svg")), "<svg>widget</svg>");
    });

    it("injects no theme link", () => {
        assert.ok(!/<link[^>]*@papit\/theme/.test(html));
    });

    it("writes .nojekyll", () => {
        assert.ok(fs.existsSync(path.join(out, ".nojekyll")));
    });
});
