import ts from "typescript";
import { logger } from "experiment/logger";
import { getResolvedPath } from "./helper";

const { log, } = logger("fxport");

// NOTE "F"xport -> export "F"rom
export function getFxport(
    program: ts.Program,
    packageLocation: string,
    node: ts.Statement,
) {
    if (!ts.isExportDeclaration(node)) 
    {
        log(node.getFullText())
        log("this was NOT an fxport")
        return null;
    }
    const resolvedPath = getResolvedPath(program, node);
    const imports: { name: string; alias: string }[] = [];

    let star = false, namespaceAlias: null | string = null;
    if (!node.exportClause)
    {
        star = true;
    }
    else if (ts.isNamespaceExport(node.exportClause))
    {
        // export * as ns from "./foo"
        namespaceAlias = node.exportClause.name.text;
    }
    else if (ts.isNamedExports(node.exportClause)) 
    {
        // export { foo, bar as baz } from "./foo"
        for (const el of node.exportClause.elements)
        {
            imports.push({
                name: (el.propertyName ?? el.name).text, // original name in the source module
                alias: el.name.text,                     // name exposed to the outside
            });
        }
    }

    return {
        node,
        imports,
        resolvedPath,
        star,
        namespaceAlias,
        external: Boolean(resolvedPath?.startsWith(packageLocation)),
    }
}