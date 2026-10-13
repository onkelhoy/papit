import path from "node:path";
import fs from "node:fs";

import ts from "typescript";

/**
 * The checker's type text for a node from our own parse of a file, `undefined` when unknown.
 * With `expand`, a type alias at the top is written out instead of named (`"a" | "b"`, not `Alias`).
 */
export type TypeOf = (node: ts.Node, expand?: boolean) => string | undefined;

const DEFAULTS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    experimentalDecorators: true,
    skipLibCheck: true,
    strict: true,
    types: [],
};

/**
 * A `TypeOf` backed by one `ts.Program`, built lazily on first use, so files that never need
 * the checker don't pay for it. Uses `<location>/tsconfig.json` when there is one.
 */
export function createTypeOf(rootNames: () => string[], location?: string): TypeOf {
    let program: ts.Program | undefined;

    return (node, expand = false) => {
        try
        {
            program ??= ts.createProgram(rootNames(), { ...options(location), noEmit: true });
            const source = program.getSourceFile(node.getSourceFile().fileName);
            const match = source && find(source, node);
            if (!match) return undefined;

            const checker = program.getTypeChecker();
            const flags = ts.TypeFormatFlags.NoTruncation | (expand ? ts.TypeFormatFlags.InTypeAlias : 0);
            const text = checker.typeToString(checker.getTypeAtLocation(match), undefined, flags);
            return text === "any" ? undefined : text;
        }
        catch
        {
            return undefined;
        }
    };
}

function options(location?: string): ts.CompilerOptions {
    const file = location && path.join(location, "tsconfig.json");
    if (!file || !fs.existsSync(file)) return DEFAULTS;

    const config = ts.readConfigFile(file, ts.sys.readFile);
    if (config.error) return DEFAULTS;
    return { ...DEFAULTS, ...ts.parseJsonConfigFileContent(config.config, ts.sys, location).options };
}

/** The node in `source` with the same span and kind as `target`. */
function find(source: ts.SourceFile, target: ts.Node): ts.Node | undefined {
    const visit = (node: ts.Node): ts.Node | undefined => {
        if (node.pos === target.pos && node.end === target.end && node.kind === target.kind) return node;
        if (node.pos > target.pos || node.end < target.end) return undefined;
        return ts.forEachChild(node, visit);
    };
    return visit(source);
}
