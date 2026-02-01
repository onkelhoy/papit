import ts from "typescript";
// import { child } from "./child";
import { logger } from "experiment/logger";
import { getImport } from "experiment/area/import";
import { getFxport } from "experiment/area/fxport";

const { log, } = logger("statement");

export function getStatements(
    program: ts.Program,
    checker: ts.TypeChecker,
    source: ts.SourceFile,
    packageLocation: string,
) {
    const data: Record<ReturnType<typeof getType>, ts.Statement[]> = {
        fxports: [],
        imports: [],
        normals: [],
        exports: [],
    }

    const local: {
        imports: {
            get: Function,
            data: Array<NonNullable<ReturnType<typeof getImport>>>,
        },
        fxports: {
            data: Array<NonNullable<ReturnType<typeof getFxport>>>,
            get: Function,
        },
    } = {
        imports: { data: [], get: getImport },
        fxports: { data: [], get: getFxport },
    }

    for (const statement of source.statements)
    {
        const type = getType(checker, statement);
        let push = true;

        switch (type)
        {
            case "fxports":
            case "imports":
                const info = local[type].get(program, packageLocation, statement);
                if (!info) 
                {
                    push = false;
                }
                else if (info.external) 
                {
                    push = false;
                    local[type].data.push(info);
                }
                break;
            case "exports":
                break;
            default:
                break;
        }

        if (push) data[type].push(statement);
    }

    return {
        data,
        local,
    };
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
    if (flags.export && flags.from) return "fxports";
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
