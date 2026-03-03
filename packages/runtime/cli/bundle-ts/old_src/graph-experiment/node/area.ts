import { TS } from "graph-experiment/utils/typescript";
import ts from "typescript";

export class Area {
    static getResolvedPath(node: ts.ImportDeclaration | ts.ExportDeclaration) {
        const moduleSpecifier = node.moduleSpecifier;
        if (!moduleSpecifier) return null;
        if (!ts.isStringLiteral(moduleSpecifier)) return null;

        const importPath = moduleSpecifier.text;

        // Resolve where this import actually points to
        const resolvedModule = ts.resolveModuleName(
            importPath,
            node.getSourceFile().fileName,
            TS.program.getCompilerOptions(),
            ts.sys
        );

        return {
            importPath,
            resolvedFileName: resolvedModule.resolvedModule?.resolvedFileName,
        };
    }

    static getFxport(
        node: ts.Statement,
    ) {
        if (!ts.isExportDeclaration(node)) 
        {
            return null;
        }
        const resolvedPath = this.getResolvedPath(node);
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
            imports,
            ...resolvedPath,
            star,
            namespaceAlias: [namespaceAlias],
            external: Boolean(!resolvedPath?.resolvedFileName?.startsWith(TS.location)),
        }
    }

    static getImport(
        node: ts.Statement,
    ) {
        if (!ts.isImportDeclaration(node)) 
        {
            return null;
        }
        const resolvedPath = this.getResolvedPath(node);

        const imports: { name: string; alias: string }[] = [];

        let sideEffectOnly = false;
        let defaultAlias: null | string = null;
        let namespaceAlias: null | string = null;
        
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
            if (bindings)
            {
                if (ts.isNamespaceImport(bindings)) {
                    // import * as Foo from "module"
                    namespaceAlias = bindings.name.text;
                }
                else if (ts.isNamedImports(bindings))
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
        }

        return {
            sideEffectOnly,
            defaultAlias: [defaultAlias],
            namespaceAlias: [namespaceAlias],
            imports,
            ...resolvedPath,
            external: Boolean(!resolvedPath?.resolvedFileName?.startsWith(TS.location)),
        }
    }
}