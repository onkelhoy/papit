import ts from "typescript";
import { Area } from "./area";

export type StatementData = ReturnType<typeof getStatements>;

export function getStatements(
    checker: ts.TypeChecker,
    source: ts.SourceFile,
    area: Area,
) {
    const data: Record<"imports" | "reexports" | "normals" | "exports", ts.Statement[]> = {
        imports: [],
        reexports: [],
        normals: [],
        exports: [],
    };

    const local: {
        imports: { data: Array<NonNullable<ReturnType<Area["import"]>>> };
        reexports: { data: Array<NonNullable<ReturnType<Area["reexport"]>>> };
    } = {
        imports: { data: [] },
        reexports: { data: [] },
    };

    for (const statement of source.statements)
    {
        const type = getType(checker, statement);
        let push = true;

        switch (type)
        {
            case "imports": {
                const info = area.import(statement);
                if (!info) { push = false; break; }
                if (!info.external) { push = false; local.imports.data.push(info); break; }
                break;
            }
            case "reexports": {
                const info = area.reexport(statement);
                if (!info) { push = false; break; }
                if (!info.external) { push = false; local.reexports.data.push(info); break; }
                break;
            }
        }

        if (push) data[type].push(statement);
    }

    return { data, local };
}

function getType(checker: ts.TypeChecker, node: ts.Node) {

    const flags = {
        export: false,
        import: false,
        from: false,
    }

    const runner = (node: ts.Node) => {
        const children = node.getChildren();
        for (const child of children)
        {

            const kind = ts.SyntaxKind[child.kind];
            switch (kind) 
            {
                case "SyntaxList":
                    return runner(child);
                case "ImportKeyword":
                case "ImportClause":
                    flags.import = true;
                    return;
                case "ExportKeyword":
                    flags.export = true;
                    break;
                case "FromKeyword":
                    flags.from = true;
                    break;
            }

            // log(kind);
        }
    }
    runner(node);

    if (flags.import) return "imports";
    if (flags.export && flags.from) return "reexports";
    if (flags.export) return "exports";

    return "normals";
}

// function statement(stmt: ts.Statement, source: ts.SourceFile) {
//     log("statement:", stmt.getText(source));

//     if (ts.isClassDeclaration(stmt))
//     {
//         log('ITS CLASS');
//     }
//     if (ts.isFunctionDeclaration(stmt))
//     {
//         log('ITS FUNCTUIN');
//     }
//     if (ts.isVariableDeclaration(stmt))
//     {
//         log('ITS VARIABLE')
//     }
//     if (ts.isEnumDeclaration(stmt))
//     {
//         log('ITS ENUM');
//     }
//     if (ts.isImportDeclaration(stmt))
//     {
//         log('ITS IMPORT');
//     }
//     if (ts.isExportDeclaration(stmt))
//     {
//         log('ITS EXPORT')
//     }

//     stmt.forEachChild(node => child(node, source));
// }
