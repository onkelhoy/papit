import path from "path";
import ts from "typescript";
import { getSource } from "./components/source";
import { getStatements } from "./components/statement";
import { printer, printFile } from "./components/print";
import { Area } from "./components/area";
import { Collect, type FileInfo } from "./components/collect";
import { RenameMap } from "./components/rename";

(function () {
    const { sources, program } = getSource([
        "./src/experiment/test/a.ts",
        // "./src/experiment/test/b.ts",
        // "./src/experiment/test/c.ts",
    ].map(v => path.resolve(v)));

    const checker = program.getTypeChecker();
    const area = new Area(program, process.cwd());

    const entries: FileInfo[] = [];
    const rest: FileInfo[] = [];

    for (const { source, entry } of sources)
    {
        const info = getStatements(checker, source, area);
        (entry ? entries : rest).push({ source, ...info });
    }

    for (const entry of entries)
    {
        const allFiles = [entry, ...rest];
        const included = new Collect(allFiles, checker, process.cwd()).run([entry]);

        // build rename map
        const renameMap = new RenameMap();
        for (const file of allFiles)
        {
            const stmts = included.get(file.source.fileName);
            if (!stmts) continue;
            for (const stmt of file.source.statements)
            {
                if (!stmts.has(stmt)) continue;
                if (ts.isFunctionDeclaration(stmt) && stmt.name) renameMap.add(stmt.name.text, file.source.fileName);
                else if (ts.isClassDeclaration(stmt) && stmt.name) renameMap.add(stmt.name.text, file.source.fileName);
                else if (ts.isTypeAliasDeclaration(stmt)) renameMap.add(stmt.name.text, file.source.fileName);
                else if (ts.isInterfaceDeclaration(stmt)) renameMap.add(stmt.name.text, file.source.fileName);
                else if (ts.isEnumDeclaration(stmt)) renameMap.add(stmt.name.text, file.source.fileName);
                else if (ts.isVariableStatement(stmt))
                    for (const decl of stmt.declarationList.declarations)
                        if (ts.isIdentifier(decl.name)) renameMap.add(decl.name.text, file.source.fileName);
            }
        }

        // categorize and print
        const { print } = printer(renameMap);
        const buckets = { reexports: [], imports: [], types: [], normals: [], exports: [] } as Record<string, string[]>;

        for (const file of allFiles)
        {
            const stmts = included.get(file.source.fileName);
            if (!stmts) continue;
            for (const stmt of file.source.statements)
            {
                if (!stmts.has(stmt)) continue;
                const printed = print(stmt, file.source);
                if (ts.isImportDeclaration(stmt)) buckets.imports.push(printed);
                else if (ts.isExportDeclaration(stmt)) buckets.reexports.push(printed);
                else if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) buckets.types.push(printed);
                else if (ts.getModifiers(stmt as ts.HasModifiers)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) buckets.exports.push(printed);
                else buckets.normals.push(printed);
            }
        }

        console.log(`=== ${entry.source.fileName} ===\n`);
        console.log(printFile(buckets));
    }
}());