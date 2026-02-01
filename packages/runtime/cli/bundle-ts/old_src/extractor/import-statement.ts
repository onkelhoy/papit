import ts from "typescript";
import { Data } from "./helper";

export function getImportStatement(
    program: ts.Program,
    checker: ts.TypeChecker,
    location: string,
    symbol: ts.Symbol,
    sourceFile: ts.SourceFile,
    data: Data,
) {
    // Check if this symbol has a local import declaration in THIS file
    const localImport = getImportForSymbol(checker, symbol, sourceFile);
    if (!localImport || data.imports.seen.has(localImport)) 
    {
        if (localImport && data.imports.external.has(localImport)) return true;
        return null;
    }
    data.imports.seen.add(localImport);

    // Check if the import is external (not from your local codebase)
    const moduleSpecifier = localImport.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return null;

    const importPath = moduleSpecifier.text;

    // Resolve where this import actually points to
    const resolvedModule = ts.resolveModuleName(
        importPath,
        localImport.getSourceFile().fileName,
        program.getCompilerOptions(),
        ts.sys
    );

    const resolvedFileName = resolvedModule.resolvedModule?.resolvedFileName;

    // Check if it's external (not in your location)
    if (!resolvedFileName || resolvedFileName.startsWith(location)) 
        return null;


    data.imports.external.add(localImport);
    
    // const importText = printer.printNode(
    //     ts.EmitHint.Unspecified,
    //     localImport,
    //     localImport.getSourceFile()
    // );
    // console.log('External import:', {importText, resolvedFileName, location});
    return localImport;
}

function getImportForSymbol(
    checker: ts.TypeChecker,
    symbol: ts.Symbol,
    sourceFile: ts.SourceFile
): ts.ImportDeclaration | undefined {
    // Get the value declaration (the import specifier/clause)
    const valueDeclaration = symbol.valueDeclaration;
    
    // Check declarations array too
    const declarations = symbol.declarations || [];
    
    for (const declaration of [valueDeclaration, ...declarations]) {
        if (!declaration) continue;
        
        if (ts.isImportSpecifier(declaration)) {
            // import { ts } from "typescript"
            const importDecl = declaration.parent.parent.parent as ts.ImportDeclaration;
            if (importDecl.getSourceFile() === sourceFile) {
                return importDecl;
            }
        }
        if (ts.isImportClause(declaration) && declaration.name) {
            // import ts from "typescript"
            const importDecl = declaration.parent as ts.ImportDeclaration;
            if (importDecl.getSourceFile() === sourceFile) {
                return importDecl;
            }
        }
        if (ts.isNamespaceImport(declaration)) {
            // import * as ts from "typescript"
            const importDecl = declaration.parent.parent as ts.ImportDeclaration;
            if (importDecl.getSourceFile() === sourceFile) {
                return importDecl;
            }
        }
    }
    
    return undefined;
}