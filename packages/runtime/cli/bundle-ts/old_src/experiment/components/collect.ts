import ts from "typescript";
import type { getStatements } from "./statement";
import type { Area } from "./area";

export type FileInfo = {
    source: ts.SourceFile;
} & ReturnType<typeof getStatements>;

export class Collect {
    private symbolMaps = new Map<string, Map<string, ts.Statement>>();
    private included = new Map<string, Set<ts.Statement>>();

    constructor(
        private allFiles: FileInfo[],
        private checker: ts.TypeChecker,
        private packageLocation: string,
    ) {
        for (const f of allFiles)
        {
            this.symbolMaps.set(f.source.fileName, this.buildSymbolMap(f));
            this.included.set(f.source.fileName, new Set());
        }
    }

    private buildSymbolMap(file: FileInfo) {
        const map = new Map<string, ts.Statement>();
        for (const stmt of [...file.data.normals, ...file.data.exports])
        {
            if (ts.isFunctionDeclaration(stmt) && stmt.name) map.set(stmt.name.text, stmt);
            else if (ts.isClassDeclaration(stmt) && stmt.name) map.set(stmt.name.text, stmt);
            else if (ts.isTypeAliasDeclaration(stmt)) map.set(stmt.name.text, stmt);
            else if (ts.isInterfaceDeclaration(stmt)) map.set(stmt.name.text, stmt);
            else if (ts.isEnumDeclaration(stmt)) map.set(stmt.name.text, stmt);
            else if (ts.isVariableStatement(stmt))
                for (const decl of stmt.declarationList.declarations)
                    if (ts.isIdentifier(decl.name)) map.set(decl.name.text, stmt);
        }
        return map;
    }

    private deps(node: ts.Node) {
        const found = new Map<string, { name: string; file: string }>();
        const checker = this.checker;
        const packageLocation = this.packageLocation;

        node.forEachChild(function visit(child) {
            if (ts.isIdentifier(child))
            {
                const sym = checker.getSymbolAtLocation(child);
                const resolved = sym && (sym.flags & ts.SymbolFlags.Alias)
                    ? checker.getAliasedSymbol(sym)
                    : sym;
                const decl = resolved?.declarations?.[0];
                const file = decl?.getSourceFile().fileName;

                if (file && file.startsWith(packageLocation) && !found.has(child.text))
                {
                    found.set(child.text, { name: child.text, file });
                }
            }
            child.forEachChild(visit);
        });

        return found;
    }

    private include(stmt: ts.Statement, file: FileInfo) {
        const set = this.included.get(file.source.fileName)!;
        if (set.has(stmt)) return;
        set.add(stmt);

        for (const { name, file: depFileName } of this.deps(stmt).values())
        {
            const depFile = this.allFiles.find(f => f.source.fileName === depFileName);
            if (!depFile) continue;

            const localDecl = this.symbolMaps.get(depFileName)?.get(name);
            if (localDecl) { this.include(localDecl, depFile); continue; }

            const imp = depFile.local.imports.data.find(i => i.imports.some(x => x.alias === name));
            if (imp?.resolvedPath)
            {
                const sourceFile = this.allFiles.find(f => f.source.fileName === imp.resolvedPath);
                if (sourceFile)
                {
                    const original = imp.imports.find(x => x.alias === name)?.name ?? name;
                    const decl = this.symbolMaps.get(imp.resolvedPath)?.get(original);
                    if (decl) this.include(decl, sourceFile);
                }
            }
        }
    }

    run(entries: FileInfo[]) {
        for (const entry of entries)
        {
            for (const stmt of entry.data.exports) this.include(stmt, entry);

            for (const reexport of entry.local.reexports.data)
            {
                if (!reexport.resolvedPath) continue;
                const target = this.allFiles.find(f => f.source.fileName === reexport.resolvedPath);
                if (!target) continue;
                for (const { name } of reexport.imports)
                {
                    const decl = this.symbolMaps.get(reexport.resolvedPath)?.get(name);
                    if (decl) this.include(decl, target);
                }
            }
        }
        return this.included;
    }
}