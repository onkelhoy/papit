import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);

/** Links `@types/react` into `root/node_modules`, so `react` resolves the way it does in a real package. */
export function linkReactTypes(root) {
    const target = path.join(root, "node_modules/@types/react");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.dirname(require.resolve("@types/react/package.json")), target, "dir");
}

/** Absolute path of `relative` under `packages/`. */
export const repo = (relative) => fileURLToPath(new URL(`../../../../${relative}`, import.meta.url));
export const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** A fresh tmp dir; realpath because on macOS the tmp dir is a symlink. */
export const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "papit-")));

/** Writes `files` (relative path → content) under `root`. */
export function write(root, files) {
    for (const [file, content] of Object.entries(files))
    {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content, null, 2));
    }
}

/** Writes the basic fixture as a web component package named `name` at `location`. */
export function fixturePackage(location, name = "@tmp/fixture") {
    const source = path.join(fixtures, "basic");
    write(location, {
        "package.json": { name, version: "1.0.0", type: "module", main: "./lib/bundle.js" },
        "tsconfig.json": { compilerOptions: { baseUrl: "src", outDir: "lib" }, include: ["src"] },
        ...Object.fromEntries(fs.readdirSync(source).map(file => [`src/${file}`, fs.readFileSync(path.join(source, file), "utf8")])),
    });
}

/**
 * Typechecks `files` against @types/react with the compiler options a web component package uses (`jsx: react-jsx`).
 * `paths` maps module names (e.g. the package's own name) to files; `options` overrides compiler options.
 * Returns the diagnostics as text.
 */
export function typecheck(files, paths = {}, options = {}) {
    const react = path.dirname(require.resolve("@types/react/package.json"));
    const program = ts.createProgram(files, {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
        experimentalDecorators: true,
        useDefineForClassFields: false,
        types: [],
        jsx: ts.JsxEmit.ReactJSX,
        paths: { react: [path.join(react, "index.d.ts")], "react/jsx-runtime": [path.join(react, "jsx-runtime.d.ts")], ...paths },
        ...options,
    });

    return ts.getPreEmitDiagnostics(program).map(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        if (!diagnostic.file) return message;
        const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
        return `${path.basename(diagnostic.file.fileName)}:${line + 1} ${message}`;
    });
}
