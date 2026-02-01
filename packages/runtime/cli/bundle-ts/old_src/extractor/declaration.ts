import ts from "typescript";

import { Data, getCanonicalSymbol, getSymbol } from "./helper";
import { getImportStatement } from "./import-statement";

export function iterateDeclaration(
    program: ts.Program,
    checker: ts.TypeChecker,
    location: string,
    declaration: ts.Declaration,
    data: Data,
    original = true,
) {
    const sourceFile = declaration.getSourceFile();

    if (!original)
    {

        // Skip if it's from a lib or node_modules
        if (sourceFile.fileName.includes('lib.es') || sourceFile.fileName.includes('node_modules')) return;

        // Take the owning statement for variables
        let stmt: ts.Node | undefined;
        if (ts.isVariableDeclaration(declaration))
        {
            stmt = declaration.parent.parent; // VariableStatement
        }
        else
        {
            stmt = declaration; // everything else is self-contained
        }

        // NEW: Only collect if the statement is a direct child of the source file
        // This skips nested declarations like properties inside type literals
        if (stmt.parent === sourceFile)
        {
            const symbol = getSymbol(stmt, checker);
            if (symbol)
            {
                const canonical = getCanonicalSymbol(checker, symbol);

                // NEW: Skip if this symbol will be exported (already in exports)
                // if (data.exports.seen.has(canonical))
                // {
                //     return; // Don't add to types - it's an export
                // }

                if (!data.types.seen.has(canonical))
                {
                    data.types.seen.add(canonical);
                    data.types.data.push({ node: stmt, sourceFile });
                }
            }
        }
    }

    const iterateNode = (node: ts.Node) => {
        ts.forEachChild(node, iterateNode);

        const kind = ts.SyntaxKind[node.kind];

        if (!["Identifier", "TypeReference"].includes(kind)) return;

        const symbol = getSymbol(node, checker);
        if (!symbol) return;

        const canonical = getCanonicalSymbol(checker, symbol);
        if (data.exports.seen.has(canonical)) return;
        data.exports.seen.add(canonical);

        const importStatement = getImportStatement(
            program,
            checker,
            location,
            symbol,
            sourceFile,
            data,
        );

        if (importStatement === true) return; // already exist 

        if (importStatement !== null)
        {
            data.imports.data.push(importStatement);
            return;
        }

        const declarations = canonical.getDeclarations();
        for (const dec of declarations ?? [])
        {
            iterateDeclaration(
                program,
                checker,
                location,
                dec,
                data,
                false,
            );
        }
    }

    ts.forEachChild(declaration, iterateNode);
}
