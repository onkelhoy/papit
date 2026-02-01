import ts from "typescript";
import { logger } from "experiment/logger";
const { log, } = logger("printer");

export function printer(printerOptions?: ts.PrinterOptions | undefined) {
    const printer = ts.createPrinter(printerOptions, {
        onEmitNode(hint, node, emitCallback) {
            // called for every node before it's printed
            // you can modify behavior or skip nodes
            emitCallback(hint, node);
        },

        substituteNode(hint, node) {
            // called for every node — return a DIFFERENT node to print instead
            // this is your rename hook
            // if (ts.isIdentifier(node) && renameMap.has(node.text)) {
            //     return ts.factory.createIdentifier(renameMap.get(node.text)!);
            // }

            // return ts.factory.createIdentifier();
            return node;
        },
    });

    return {
        print(node: ts.Node, source: ts.SourceFile) {
            return printer.printNode(ts.EmitHint.Unspecified, node, source);
        },
        printer,
    }
}

export function printFile(
    reexports = [],
    imports = [],
    types = [],
    exports = [],
) {
    return [
        reexports,
        imports,
        , ,
        types,
        , ,
        exports,
    ].filter(Boolean).flat().join("\n");
}