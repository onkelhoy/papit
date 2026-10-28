import { describe, it } from "node:test";
import assert from "node:assert";

import { rewriteCssImports } from "@papit/server";

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
