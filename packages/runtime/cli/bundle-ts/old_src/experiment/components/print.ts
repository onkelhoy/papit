import ts from "typescript";
import type { RenameMap } from "./rename";

export function printer(renameMap?: RenameMap, options?: ts.PrinterOptions) {
    const p = ts.createPrinter(options, {
        substituteNode(hint, node) {
            if (renameMap && ts.isIdentifier(node))
            {
                const file = node.getSourceFile();
                if (file)
                {
                    const renamed = renameMap.get(node.text, file.fileName);
                    if (renamed && renamed !== node.text)
                        return ts.factory.createIdentifier(renamed);
                }
            }
            return node;
        },
    });

    return {
        print(node: ts.Node, source: ts.SourceFile) {
            return p.printNode(ts.EmitHint.Unspecified, node, source);
        },
    };
}

const gap = "\n";

export function printFile({
    reexports = [],
    imports = [],
    types = [],
    exports = [],
}: {
    reexports?: string[];
    imports?: string[];
    types?: string[];
    exports?: string[];
}) {

    return [
        reexports,
        imports,
        , ,
        types,
        , ,
        exports,
    ].filter(Boolean).flat().join("\n");
}