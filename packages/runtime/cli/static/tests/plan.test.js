import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";

import {
    normalizeBase,
    assetPath,
    planAssets,
    planTranslations,
    dependencyPath,
    rewriteImportmap,
    fetchShim,
    rewriteCssImports,
    resolveSpecifier,
    resolveTarget,
    packageEntries,
    isTooling,
} from "@papit/static";

const FOLDERS = ["asset", "assets", "public"];

// mirrors how @papit/server registers an asset: every trailing part of its package-relative path
function register(assets, location, relative) {
    const file = path.join(location, relative);
    const segments = relative.split("/");
    while (segments.length > 0)
    {
        const key = path.join(path.sep + segments.join(path.sep));
        if (!assets[key]) assets[key] = [];
        assets[key].push(file);
        segments.shift();
    }
    return file;
}

describe("normalizeBase", () => {
    it("defaults to /", () => {
        assert.strictEqual(normalizeBase(), "/");
        assert.strictEqual(normalizeBase(""), "/");
        assert.strictEqual(normalizeBase("/"), "/");
    });

    it("adds the leading and trailing slash", () => {
        assert.strictEqual(normalizeBase("papit"), "/papit/");
        assert.strictEqual(normalizeBase("/papit"), "/papit/");
        assert.strictEqual(normalizeBase("papit/"), "/papit/");
        assert.strictEqual(normalizeBase("/a/b/"), "/a/b/");
    });

    it("keeps an absolute URL, with a trailing slash", () => {
        assert.strictEqual(normalizeBase("https://onkelhoy.github.io/papit"), "https://onkelhoy.github.io/papit/");
    });
});

describe("assetPath", () => {
    it("strips everything up to the asset folder", () => {
        assert.strictEqual(assetPath("asset/icons/x.svg", FOLDERS), "icons/x.svg");
        assert.strictEqual(assetPath("views/demo/public/images/a.png", FOLDERS), "images/a.png");
        assert.strictEqual(assetPath("assets/favicon.svg", FOLDERS), "favicon.svg");
    });

    it("uses the first asset folder in the path", () => {
        assert.strictEqual(assetPath("asset/public/x.svg", FOLDERS), "public/x.svg");
    });

    it("honours extra asset folder names", () => {
        assert.strictEqual(assetPath("static/x.svg", FOLDERS), null);
        assert.strictEqual(assetPath("static/x.svg", [...FOLDERS, "static"]), "x.svg");
    });

    it("accepts platform separators", () => {
        assert.strictEqual(assetPath(["asset", "icons", "x.svg"].join(path.sep), FOLDERS), "icons/x.svg");
    });
});

describe("planAssets", () => {
    it("lets the closest (last registered) package win a shared path", () => {
        const assets = {};
        register(assets, "/ws/packages/base", "asset/icons/shared.svg");
        const closest = register(assets, "/ws/packages/app", "asset/icons/shared.svg");

        const plan = planAssets(assets, FOLDERS);

        assert.deepStrictEqual(Object.keys(plan.files), ["icons/shared.svg"]);
        assert.strictEqual(plan.files["icons/shared.svg"], closest);
    });

    it("lets the closest package win across different asset folder names", () => {
        const assets = {};
        register(assets, "/ws/packages/base", "assets/icons/shared.svg");
        const closest = register(assets, "/ws/packages/app", "public/icons/shared.svg");

        const plan = planAssets(assets, FOLDERS);

        assert.strictEqual(plan.files["icons/shared.svg"], closest);
        assert.strictEqual(Object.keys(plan.files).length, 1);
    });

    it("keeps every distinct path", () => {
        const assets = {};
        const a = register(assets, "/ws/packages/base", "asset/icons/a.svg");
        const b = register(assets, "/ws/packages/app", "asset/icons/b.svg");
        const c = register(assets, "/ws/packages/app", "asset/images/a.svg");

        const plan = planAssets(assets, FOLDERS);

        assert.deepStrictEqual(plan.files, {
            "icons/a.svg": a,
            "icons/b.svg": b,
            "images/a.svg": c,
        });
    });

    it("maps every request path the dev server answers to the winning output path", () => {
        const assets = {};
        register(assets, "/ws/packages/base", "asset/icons/x.svg");
        register(assets, "/ws/packages/app", "asset/x.svg");

        const plan = planAssets(assets, FOLDERS);

        assert.strictEqual(plan.urls["/asset/icons/x.svg"], "icons/x.svg");
        assert.strictEqual(plan.urls["/icons/x.svg"], "icons/x.svg");
        // both packages answer /x.svg; the closest one (app) wins, like streamAsset
        assert.strictEqual(plan.urls["/x.svg"], "x.svg");
        assert.strictEqual(plan.urls["/asset/x.svg"], "x.svg");
    });

    it("leaves out files the filter rejects", () => {
        const assets = {};
        register(assets, "/ws/server", "asset/templates/live/main.js");
        const kept = register(assets, "/ws/server", "asset/favicon.svg");

        const plan = planAssets(assets, FOLDERS, file => !file.includes("templates"));

        assert.deepStrictEqual(plan.files, { "favicon.svg": kept });
        assert.strictEqual(plan.urls["/main.js"], undefined);
    });
});

describe("planTranslations", () => {
    it("writes one merged file per language and maps every request path to it", () => {
        const plan = planTranslations({
            data: {
                "en-UK": { meta: { language: "en-UK", region: "GB" }, a: "a", b: "b" },
                "sv": { meta: { language: "sv", region: "SE" }, a: "å" },
            },
            map: {
                "/asset/translations/en.json": "en-UK",
                "/translations/en.json": "en-UK",
                "/en.json": "en-UK",
                "/sv.json": "sv",
            },
        });

        assert.deepStrictEqual(Object.keys(plan.files).sort(), ["translations/en-UK.json", "translations/sv.json"]);
        assert.deepStrictEqual(plan.files["translations/en-UK.json"], { meta: { language: "en-UK", region: "GB" }, a: "a", b: "b" });
        assert.strictEqual(plan.urls["/en.json"], "translations/en-UK.json");
        assert.strictEqual(plan.urls["/translations/en.json"], "translations/en-UK.json");
        assert.strictEqual(plan.urls["/sv.json"], "translations/sv.json");
    });
});

describe("dependencyPath", () => {
    it("places a file under lib/<package>/", () => {
        assert.strictEqual(
            dependencyPath("@fake/widget", "/ws/packages/widget", "/ws/packages/widget/lib/bundle.js"),
            "lib/@fake/widget/lib/bundle.js",
        );
    });

    it("uses forward slashes", () => {
        const root = path.join(path.sep, "ws", "pkg");
        assert.strictEqual(dependencyPath("pkg", root, path.join(root, "dist", "a", "b.js")), "lib/pkg/dist/a/b.js");
    });
});

describe("rewriteImportmap", () => {
    it("points every entry at base + its dependency path", () => {
        const located = [];
        const map = rewriteImportmap(
            {
                "@papit/a": "/ws/packages/a/lib/bundle.js",
                "@papit/a/extra": "/ws/packages/a/lib/extra.js",
            },
            "/papit/",
            file => {
                located.push(file);
                return "lib/@papit/a/" + path.relative("/ws/packages/a", file);
            },
        );

        assert.deepStrictEqual(map, {
            imports: {
                "@papit/a": "/papit/lib/@papit/a/lib/bundle.js",
                "@papit/a/extra": "/papit/lib/@papit/a/lib/extra.js",
            },
        });
        assert.deepStrictEqual(located, ["/ws/packages/a/lib/bundle.js", "/ws/packages/a/lib/extra.js"]);
    });

    it("decodes the URL-encoded paths the server produces", () => {
        let seen = null;
        rewriteImportmap({ x: "/my%20ws/x/lib/bundle.js" }, "/", file => { seen = file; return "lib/x/lib/bundle.js"; });
        assert.strictEqual(seen, "/my ws/x/lib/bundle.js");
    });
});

describe("fetchShim", () => {
    it("embeds the URL map", () => {
        const script = fetchShim({ "/en.json": "/papit/assets/translations/en-UK.json" });
        assert.ok(script.includes(`"/en.json":"/papit/assets/translations/en-UK.json"`));
        assert.ok(script.includes("window.fetch"));
    });

    it("cannot close its own script tag", () => {
        const script = fetchShim({ "/a</script>.json": "/b" });
        assert.ok(!script.toLowerCase().includes("</script"));
    });
});

describe("rewriteCssImports", () => {
    const urls = {
        "@acme/theme": "/papit/lib/@acme/theme/lib/theme.css",
        "plain-css": "/papit/lib/plain-css/index.css",
        "@acme/theme/dark.css": "/papit/lib/@acme/theme/lib/dark.css",
    };
    const resolve = specifier => urls[specifier];

    it("rewrites a scoped package", () => {
        const result = rewriteCssImports(`@import "@acme/theme";\nh1 { color: red; }`, resolve);
        assert.strictEqual(result.css, `@import "/papit/lib/@acme/theme/lib/theme.css";\nh1 { color: red; }`);
        assert.deepStrictEqual(result.unresolved, []);
    });

    it("rewrites an unscoped package", () => {
        assert.strictEqual(rewriteCssImports(`@import 'plain-css';`, resolve).css, `@import '/papit/lib/plain-css/index.css';`);
    });

    it("rewrites a subpath", () => {
        assert.strictEqual(rewriteCssImports(`@import "@acme/theme/dark.css";`, resolve).css, `@import "/papit/lib/@acme/theme/lib/dark.css";`);
    });

    it("rewrites the url() forms", () => {
        assert.strictEqual(rewriteCssImports(`@import url("@acme/theme");`, resolve).css, `@import url("/papit/lib/@acme/theme/lib/theme.css");`);
        assert.strictEqual(rewriteCssImports(`@import url(plain-css);`, resolve).css, `@import url(/papit/lib/plain-css/index.css);`);
    });

    it("keeps a media or layer suffix", () => {
        assert.strictEqual(
            rewriteCssImports(`@import "@acme/theme/dark.css" layer(theme) (prefers-color-scheme: dark);`, resolve).css,
            `@import "/papit/lib/@acme/theme/lib/dark.css" layer(theme) (prefers-color-scheme: dark);`,
        );
    });

    it("never asks about relative, absolute or scheme URLs", () => {
        const asked = [];
        const css = [`@import "./a.css";`, `@import "../b.css";`, `@import "/c.css";`, `@import url("https://x.dev/d.css");`, `@import url(data:text/css,h1{});`].join("\n");
        const result = rewriteCssImports(css, specifier => { asked.push(specifier); return "/nope"; });
        assert.strictEqual(result.css, css);
        assert.deepStrictEqual(asked, []);
        assert.deepStrictEqual(result.unresolved, []);
    });

    it("leaves a specifier the resolver keeps local (null) alone, without reporting it", () => {
        const result = rewriteCssImports(`@import "reset.css";`, () => null);
        assert.strictEqual(result.css, `@import "reset.css";`);
        assert.deepStrictEqual(result.unresolved, []);
    });

    it("leaves an unknown name alone and reports it", () => {
        const result = rewriteCssImports(`@import "@nobody/thing";`, resolve);
        assert.strictEqual(result.css, `@import "@nobody/thing";`);
        assert.deepStrictEqual(result.unresolved, ["@nobody/thing"]);
    });

    it("handles several imports in one file", () => {
        const result = rewriteCssImports(`@import "@acme/theme";\n@import "./local.css";\n@import url('plain-css') screen;\n@import "missing";`, resolve);
        assert.strictEqual(result.css, `@import "/papit/lib/@acme/theme/lib/theme.css";\n@import "./local.css";\n@import url('/papit/lib/plain-css/index.css') screen;\n@import "missing";`);
        assert.deepStrictEqual(result.unresolved, ["missing"]);
    });
});

describe("resolveSpecifier", () => {
    const packages = {
        "@acme/theme": { root: "/nm/@acme/theme", packageJSON: { exports: { ".": "./lib/theme.css", "./dark.css": "./lib/dark.css" } } },
        "plain-css": { root: "/nm/plain-css", packageJSON: { main: "index.css" } },
    };

    it("resolves a bare name through exports \".\"", () => {
        assert.strictEqual(resolveSpecifier("@acme/theme", packages), "/nm/@acme/theme/lib/theme.css");
    });

    it("resolves a subpath through its exports key", () => {
        assert.strictEqual(resolveSpecifier("@acme/theme/dark.css", packages), "/nm/@acme/theme/lib/dark.css");
    });

    it("falls back to main", () => {
        assert.strictEqual(resolveSpecifier("plain-css", packages), "/nm/plain-css/index.css");
    });

    it("resolves a subpath of a package without exports to the file in it", () => {
        assert.strictEqual(resolveSpecifier("plain-css/extra.css", packages), "/nm/plain-css/extra.css");
    });

    it("returns undefined for an unknown package or an unexported subpath", () => {
        assert.strictEqual(resolveSpecifier("@nobody/thing", packages), undefined);
        assert.strictEqual(resolveSpecifier("@acme/theme/secret.css", packages), undefined);
    });
});

describe("resolveTarget", () => {
    const pkg = { packageLocation: "/ws/packages/hello", packageName: "@fake/hello" };
    const fs = (dirs, html = []) => ({
        isDir: folder => dirs.includes(folder),
        hasHtml: folder => html.includes(folder),
    });

    it("takes --target relative to the cwd first", () => {
        const folder = resolveTarget({ ...pkg, cwd: "/ws/packages/hello", target: "demo", ...fs(["/ws/packages/hello/demo", "/ws/packages/hello/views/demo"]) });
        assert.strictEqual(folder, "/ws/packages/hello/demo");
    });

    it("falls back to views/<target>", () => {
        const folder = resolveTarget({ ...pkg, cwd: "/ws/packages/hello", target: "demo", ...fs(["/ws/packages/hello/views/demo"]) });
        assert.strictEqual(folder, "/ws/packages/hello/views/demo");
    });

    it("accepts a relative path as --target", () => {
        const folder = resolveTarget({ ...pkg, cwd: "/ws/packages/hello/views", target: "../site/a", ...fs(["/ws/packages/hello/site/a"]) });
        assert.strictEqual(folder, "/ws/packages/hello/site/a");
    });

    it("names both folders when --target is not found", () => {
        assert.throws(
            () => resolveTarget({ ...pkg, cwd: "/ws/packages/hello", target: "nope", ...fs([]) }),
            error => error.message.includes("/ws/packages/hello/nope") && error.message.includes("/ws/packages/hello/views/nope"),
        );
    });

    it("without --target, uses the cwd when it holds .html files", () => {
        const cwd = "/ws/packages/hello/views/raw";
        const folder = resolveTarget({ ...pkg, cwd, ...fs([cwd, "/ws/packages/hello/views/github"], [cwd]) });
        assert.strictEqual(folder, cwd);
    });

    it("then views/github", () => {
        const folder = resolveTarget({ ...pkg, cwd: "/ws/packages/hello", ...fs(["/ws/packages/hello/views/github", "/ws/packages/hello/views/hello"]) });
        assert.strictEqual(folder, "/ws/packages/hello/views/github");
    });

    it("then views/<package name without scope>", () => {
        const folder = resolveTarget({ ...pkg, cwd: "/ws/packages/hello", ...fs(["/ws/packages/hello/views/hello"]) });
        assert.strictEqual(folder, "/ws/packages/hello/views/hello");
    });

    it("names every folder it tried when nothing matches", () => {
        assert.throws(
            () => resolveTarget({ ...pkg, cwd: "/ws/packages/hello", ...fs([]) }),
            error => ["/ws/packages/hello", "/ws/packages/hello/views/github", "/ws/packages/hello/views/hello"].every(folder => error.message.includes(folder)),
        );
    });
});

describe("packageEntries", () => {
    it("maps main to the package name", () => {
        assert.deepStrictEqual(packageEntries("ext", "/nm/ext", { main: "dist/index.js" }), { ext: "/nm/ext/dist/index.js" });
    });

    it("maps exports (string, import condition, default condition) with subpaths", () => {
        assert.deepStrictEqual(
            packageEntries("ext", "/nm/ext", {
                exports: {
                    ".": { import: "./esm/index.js", require: "./cjs/index.js" },
                    "./extra": "./esm/extra.js",
                    "./other": { default: "./esm/other.js" },
                    "./*": "./esm/*.js",
                },
                main: "./cjs/index.js",
            }),
            {
                "ext": "/nm/ext/esm/index.js",
                "ext/extra": "/nm/ext/esm/extra.js",
                "ext/other": "/nm/ext/esm/other.js",
            },
        );
    });

    it("maps a string export", () => {
        assert.deepStrictEqual(packageEntries("ext", "/nm/ext", { exports: "./index.mjs" }), { ext: "/nm/ext/index.mjs" });
    });
});

describe("isTooling", () => {
    it("flags build and test tooling", () => {
        for (const name of ["@playwright/test", "playwright", "typescript", "esbuild", "chokidar", "@microsoft/api-extractor", "@types/node"])
        {
            assert.strictEqual(isTooling(name), true, name);
        }
    });

    it("flags subpath specifiers of tooling", () => {
        assert.strictEqual(isTooling("@playwright/test/reporter"), true);
        assert.strictEqual(isTooling("typescript/lib/x"), true);
    });

    it("lets runtime packages through", () => {
        assert.strictEqual(isTooling("lit"), false);
        assert.strictEqual(isTooling("@fake/widget"), false);
        assert.strictEqual(isTooling("playwright-like"), false);
    });
});
