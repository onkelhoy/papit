import ts from "typescript";
import { Data, getCanonicalSymbol } from "./helper";
import { iterateDeclaration } from "./declaration";

export function extractSymbols(
    program: ts.Program,
    checker: ts.TypeChecker,
    location: string,
    symbols: Set<ts.Symbol>,
) {
    const data: Data = {
        imports: { seen: new Set(), external: new Set(), data: [] },
        // reexports: { seen: new Set(), data: [] },
        exports: { seen: new Set(), data: [] },
        types: { seen: new Set(), data: [] },
    };

    for (const symbol of symbols)
    {
        const canonical = getCanonicalSymbol(checker, symbol);
        data.exports.seen.add(canonical);

        // FIX: Get declarations first, then find source file from ANY declaration
        const declarations = canonical.getDeclarations() ?? [];
        if (declarations.length === 0) continue;

        // Get source file from the first declaration (could be value or type)
        const sourceFile = declarations[0].getSourceFile();
        if (!sourceFile) continue;

        for (const declaration of declarations)
        {
            iterateDeclaration(
                program,
                checker,
                location,
                declaration,
                data,
            );

            let stmt: ts.Statement | undefined;
            if (ts.isVariableDeclaration(declaration)) 
            {
                stmt = declaration.parent.parent;
            }

            data.exports.data.push({ node: stmt ?? declaration, sourceFile });
        }
    }

    return data;
}