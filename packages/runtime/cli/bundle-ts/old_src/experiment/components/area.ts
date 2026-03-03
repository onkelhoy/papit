import ts from "typescript";

export class Area {
    constructor(
        private program: ts.Program,
        private packageLocation: string,
    ) { }

    private resolvedPath(node: ts.ImportDeclaration | ts.ExportDeclaration) {
        const spec = node.moduleSpecifier;
        if (!spec || !ts.isStringLiteral(spec)) return null;
        const resolved = ts.resolveModuleName(
            spec.text,
            node.getSourceFile().fileName,
            this.program.getCompilerOptions(),
            ts.sys,
        );
        return resolved.resolvedModule?.resolvedFileName ?? null;
    }

    private isExternal(path: string | null) {
        return Boolean(path?.startsWith(this.packageLocation));
    }

    private namedPairs(elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>) {
        return Array.from(elements).map(el => ({
            name: (el.propertyName ?? el.name).text,
            alias: el.name.text,
        }));
    }

    import(node: ts.Statement) {
        if (!ts.isImportDeclaration(node)) return null;
        const resolvedPath = this.resolvedPath(node);
        const imports: { name: string; alias: string }[] = [];
        let sideEffectOnly = false;
        let defaultAlias: string | null = null;
        let namespaceAlias: string | null = null;

        if (!node.importClause)
        {
            sideEffectOnly = true;
        } else
        {
            defaultAlias = node.importClause.name?.text ?? null;
            const bindings = node.importClause.namedBindings;
            if (bindings)
            {
                if (ts.isNamespaceImport(bindings)) namespaceAlias = bindings.name.text;
                else if (ts.isNamedImports(bindings)) imports.push(...this.namedPairs(bindings.elements));
            }
        }

        return { node, imports, resolvedPath, sideEffectOnly, defaultAlias, namespaceAlias, external: this.isExternal(resolvedPath) };
    }

    reexport(node: ts.Statement) {
        if (!ts.isExportDeclaration(node)) return null;
        const resolvedPath = this.resolvedPath(node);
        const imports: { name: string; alias: string }[] = [];
        let star = false;
        let namespaceAlias: string | null = null;

        if (!node.exportClause) star = true;
        else if (ts.isNamespaceExport(node.exportClause)) namespaceAlias = node.exportClause.name.text;
        else if (ts.isNamedExports(node.exportClause)) imports.push(...this.namedPairs(node.exportClause.elements));

        return { node, imports, resolvedPath, star, namespaceAlias, external: this.isExternal(resolvedPath) };
    }
}