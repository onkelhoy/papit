import ts from "typescript";
import { logger } from "experiment/logger";
import { getResolvedPath } from "./helper";

const { log, } = logger("import");

export function getImport(
    program: ts.Program,
    packageLocation: string,
    node: ts.Statement,
) {
    if (!ts.isImportDeclaration(node)) 
    {
        log(node.getFullText())
        log("this was NOT an import")
        return null;
    }
    const resolvedPath = getResolvedPath(program, node);

    const imports: { name: string; alias: string }[] = [];

    let sideEffectOnly = false;
    let defaultAlias: null | string = null;
    if (!node.importClause)
    {
        sideEffectOnly = true;
    }
    else 
    {
        if (node.importClause.name)
        {
            defaultAlias = node.importClause.name.text;
        }

        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
        {
            for (const el of bindings.elements)
            {
                imports.push({
                    name: (el.propertyName ?? el.name).text, // original name
                    alias: el.name.text,                      // alias (same as name if no alias)
                });
            }
        }
    }

    return {
        node,
        sideEffectOnly,
        defaultAlias,
        imports,
        resolvedPath,
        external: Boolean(resolvedPath?.startsWith(packageLocation)),
    }
}