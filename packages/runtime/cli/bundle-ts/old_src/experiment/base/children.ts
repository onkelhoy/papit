import ts from "typescript";
import { logger } from "experiment/logger";

const { log, } = logger("child");

export function getChildren(
    checker: ts.TypeChecker,
    node: ts.Node,
    originalSource: ts.SourceFile,
) {
    node.forEachChild(function visit(child) {
        // log(ts.SyntaxKind[child.kind]);

        if (ts.isIdentifier(child))
        {
            const symbol = checker.getSymbolAtLocation(child);

            // symbol can point to an alias (import), follow it to the real thing
            const resolved = symbol
                ? checker.getAliasedSymbol(symbol)  // no-op if not an alias
                : undefined;

            // const target = resolved ?? symbol;
            // const declaration = target?.declarations?.[0];


            log('itedntiefier found', child.text) // , declaration?.getFullText(declaration?.getSourceFile()))
        }

        child.forEachChild(visit);
    })
}