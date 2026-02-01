import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { type Data, getCanonicalSymbol, getSymbol } from "./extractor/helper";
import { type ExportMetadata } from "./extractor/exports";

export function output(
    printer: ts.Printer,
    data: Data,
    location: string,
    outputFile: string,
    commonData?: Data,
    checker?: ts.TypeChecker,
    metadata?: Map<ts.Symbol, ExportMetadata>,
    externalReexports?: ts.ExportDeclaration[],
) {
    if (!metadata || !checker)
    {
        return writeFallbackOutput(printer, data, outputFile, externalReexports);
    }

    const renameMap = buildCollisionRenameMap(metadata, checker);
    const commonImports = buildCommonImports(data, commonData, checker);
    const filteredTypes = filterTypes(data, commonData, checker, metadata);
    const imports = mergeImports(data);

    const { exports, baseTypes } = processExports(
        printer,
        data,
        location,
        metadata,
        checker,
        renameMap
    );

    writeOutput(
        outputFile,
        commonImports,
        imports,
        externalReexports || [],
        printer,
        filteredTypes,
        baseTypes,
        exports
    );
}

// ============= COLLISION DETECTION =============

function buildCollisionRenameMap(
    metadata: Map<ts.Symbol, ExportMetadata>,
    checker: ts.TypeChecker
): Map<ts.Symbol, string> {
    const nameCollisions = new Map<string, ts.Symbol[]>();

    // Group by actual declaration name
    for (const [sym, meta] of metadata)
    {
        const exportName = sym.getName();
        if (exportName === "default") continue;

        // Skip default re-exports - they already have their export alias name
        if (meta.originalName === "default") continue;

        const actualName = meta.originalName || exportName;
        if (!nameCollisions.has(actualName))
        {
            nameCollisions.set(actualName, []);
        }
        nameCollisions.get(actualName)!.push(sym);
    }

    // Build rename map for collisions
    const renameMap = new Map<ts.Symbol, string>();
    for (const [name, syms] of nameCollisions)
    {
        if (syms.length <= 1) continue;

        // Check if these are truly different types
        const uniqueCanonicals = new Set(syms.map(s => getCanonicalSymbol(checker, s)));
        if (uniqueCanonicals.size <= 1) continue;

        syms.forEach((sym, i) => {
            if (i === 0) return;

            // Get the ORIGINAL declaration file, not the re-export file
            const canonical = getCanonicalSymbol(checker, sym);
            const originalDecl = canonical.valueDeclaration || canonical.declarations?.[0];
            const sourceFile = originalDecl?.getSourceFile().fileName || '';
            const suffix = path.basename(sourceFile, '.d.ts').replace(/[^a-zA-Z0-9]/g, '_');
            const newName = `${name}_${suffix}`;

            renameMap.set(canonical, newName);
        });
    }

    return renameMap;
}

function applyAllRenames(text: string, renameMap: Map<ts.Symbol, string>): string {
    for (const [sym, newName] of renameMap)
    {
        const oldName = sym.getName();
        text = text.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
    }
    return text;
}

// ============= COMMON IMPORTS =============

function buildCommonImports(
    data: Data,
    commonData: Data | undefined,
    checker: ts.TypeChecker
): Set<string> {
    const commonImports = new Set<string>();
    if (!commonData) return commonImports;

    for (const { node } of data.types.data)
    {
        const symbol = getSymbol(node, checker);
        if (!symbol) continue;

        const canonical = getCanonicalSymbol(checker, symbol);
        if (commonData.exports.seen.has(canonical))
        {
            commonImports.add(symbol.name);
        }
    }

    return commonImports;
}

// ============= TYPE FILTERING =============

function filterTypes(
    data: Data,
    commonData: Data | undefined,
    checker: ts.TypeChecker,
    metadata: Map<ts.Symbol, ExportMetadata>
): Array<{ node: ts.Node; sourceFile: ts.SourceFile }> {
    const exportedCanonicals = new Set(
        Array.from(metadata.keys()).map(sym => getCanonicalSymbol(checker, sym))
    );

    return data.types.data
        .filter(({ node }) => {
            if (!commonData) return true;
            const symbol = getSymbol(node, checker);
            if (!symbol) return true;
            return !commonData.exports.seen.has(getCanonicalSymbol(checker, symbol));
        })
        .filter(({ node }) => {
            if (exportedCanonicals.size === 0) return true;
            const symbol = getSymbol(node, checker);
            if (!symbol) return true;
            return !exportedCanonicals.has(getCanonicalSymbol(checker, symbol));
        });
}

// ============= EXPORT PROCESSING =============

function processExports(
    printer: ts.Printer,
    data: Data,
    location: string,
    metadata: Map<ts.Symbol, ExportMetadata>,
    checker: ts.TypeChecker,
    renameMap: Map<ts.Symbol, string>
): { exports: string[]; baseTypes: string[] } {
    const exports: string[] = [];
    const baseTypes: string[] = [];
    const processedDeclarations = new Set<ts.Node>();

    for (const [sym, meta] of metadata)
    {
        const canonical = getCanonicalSymbol(checker, sym);
        const exportedName = meta.originalName ? sym.getName() : (renameMap.get(canonical) || sym.getName());

        const declarations = data.exports.data.filter(({ node }) => {
            const nodeSym = getSymbol(node, checker);
            return nodeSym && getCanonicalSymbol(checker, nodeSym) === canonical;
        });

        if (declarations.length === 0) continue;

        if (meta.originalName)
        {
            processOriginalNameExport(
                printer,
                checker,
                data,
                sym,
                canonical,
                meta,
                location,
                declarations[0],
                processedDeclarations,
                exportedName,
                metadata,
                baseTypes,
                exports,
                renameMap
            );
        } else
        {
            processDirectExports(
                printer,
                data,
                declarations,
                canonical,
                exportedName,
                checker,
                processedDeclarations,
                renameMap,
                baseTypes,
                exports
            );
        }
    }

    exports.sort(sortExports);
    return { exports, baseTypes };
}

function processOriginalNameExport(
    printer: ts.Printer,
    checker: ts.TypeChecker,
    data: Data,
    sym: ts.Symbol,
    canonical: ts.Symbol,
    meta: ExportMetadata,
    location: string,
    declaration: { node: ts.Statement | ts.Declaration; sourceFile: ts.SourceFile },
    processedDeclarations: Set<ts.Node>,
    exportedName: string,
    metadata: Map<ts.Symbol, ExportMetadata>,
    baseTypes: string[],
    exports: string[],
    renameMap: Map<ts.Symbol, string>
) {
    // Skip external symbols
    const isExternal = sym.getDeclarations()?.some(decl => {
        const declFile = decl.getSourceFile().fileName;
        return !path.resolve(declFile).startsWith(path.resolve(location));
    });
    if (isExternal) return;

    // Handle default re-exports
    if (meta.originalName === "default")
    {
        if (!declaration.node.getSourceFile().fileName.startsWith(location)) return;

        if (!processedDeclarations.has(declaration.node))
        {
            processedDeclarations.add(declaration.node);

            let printed = printer.printNode(ts.EmitHint.Unspecified, declaration.node, declaration.sourceFile);
            if (data.exports.data.length > 1)
            {
                printed = printed.replace(/^export default\s+/, '');
            }

            printed = applyAllRenames(printed, renameMap);
            printed = renameDeclaration(printed, declaration, exportedName);

            if (!printed.startsWith('export '))
            {
                printed = 'export ' + printed;
            }

            exports.push(printed);
        }
        return;
    }

    // Handle type aliases
    if (!processedDeclarations.has(declaration.node))
    {
        const isAlsoExportedDirectly = Array.from(metadata.entries()).some(([s, m]) =>
            getCanonicalSymbol(checker, s) === canonical && !m.originalName
        );

        if (!isAlsoExportedDirectly)
        {
            processedDeclarations.add(declaration.node);
            let baseType = printer.printNode(ts.EmitHint.Unspecified, declaration.node, declaration.sourceFile)
                .replace(/^export /, '');
            baseType = applyAllRenames(baseType, renameMap);
            baseTypes.push(baseType);
        }
    }

    // Find renamed originalName
    let originalName = meta.originalName!;
    for (const [s, newName] of renameMap)
    {
        if (s.getName() === originalName)
        {
            originalName = newName;
            break;
        }
    }

    exports.push(`export type ${exportedName} = ${originalName};`);
}

function processDirectExports(
    printer: ts.Printer,
    data: Data,
    declarations: Array<{ node: ts.Statement | ts.Declaration; sourceFile: ts.SourceFile }>,
    canonical: ts.Symbol,
    exportedName: string,
    checker: ts.TypeChecker,
    processedDeclarations: Set<ts.Node>,
    renameMap: Map<ts.Symbol, string>,
    baseTypes: string[],
    exports: string[]
) {
    for (const declaration of declarations)
    {
        if (processedDeclarations.has(declaration.node)) continue;
        processedDeclarations.add(declaration.node);

        let printed = printer.printNode(ts.EmitHint.Unspecified, declaration.node, declaration.sourceFile);
        if (data.exports.data.length > 1)
        {
            printed = printed.replace(/^export default/, 'export');
        }

        // Apply collision renames first
        if (renameMap.has(canonical))
        {
            const oldName = canonical.getName();
            const newName = renameMap.get(canonical)!;
            printed = printed.replace(
                new RegExp(`\\b(class|function|const|let|var|enum|interface|type|namespace)\\s+${oldName}\\b`),
                `$1 ${newName}`
            );
        }

        // Apply ALL renames to type references
        printed = applyAllRenames(printed, renameMap);

        const declSym = getSymbol(declaration.node, checker);

        // Handle default exports
        if (exportedName === "default")
        {
            const isClassOrFunction =
                ts.isClassDeclaration(declaration.node) ||
                ts.isFunctionDeclaration(declaration.node);

            if (isClassOrFunction && printed.startsWith('export default'))
            {
                exports.push(printed);
            } else
            {
                printed = printed.replace(/^export\s+/, '');
                baseTypes.push(printed);
                exports.push(`export default ${declSym?.getName() || 'default'};`);
            }
            continue;
        }

        // Handle renamed exports (import as)
        if (declSym && declSym.getName() !== exportedName)
        {
            printed = printed.replace(/^export default\s+/, '');
            printed = renameDeclaration(printed, declaration, exportedName);

            if (printed.match(/^declare\s/) || !printed.startsWith('export '))
            {
                printed = 'export ' + printed;
            }
        }

        exports.push(printed);
    }
}

// ============= UTILITIES =============

function renameDeclaration(
    printed: string,
    declaration: { node: ts.Statement | ts.Declaration },
    newName: string
): string {
    const declName = getDeclarationType(declaration);
    if (!declName) return printed;

    const regex = new RegExp(`\\b(class|function|const|let|var|enum|interface|type|namespace)\\s+${declName}\\b`);
    return printed.replace(regex, `$1 ${newName}`);
}

function getDeclarationType(declaration: { node: ts.Declaration | ts.Statement }): string | null {
    if (ts.isClassDeclaration(declaration.node) && declaration.node.name)
    {
        return declaration.node.name.text;
    }
    if (ts.isFunctionDeclaration(declaration.node) && declaration.node.name)
    {
        return declaration.node.name.text;
    }
    if (ts.isVariableStatement(declaration.node))
    {
        const decl = declaration.node.declarationList.declarations[0];
        if (ts.isIdentifier(decl.name))
        {
            return decl.name.text;
        }
    }
    if (ts.isTypeAliasDeclaration(declaration.node))
    {
        return declaration.node.name.text;
    }
    return null;
}

function sortExports(a: string, b: string): number {
    const atype = a.match(/export (?<type>\w+)/)?.groups?.type;
    const btype = b.match(/export (?<type>\w+)/)?.groups?.type;
    if (!atype || !btype) return a.localeCompare(b);
    const diff = btype.localeCompare(atype);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
}

function mergeImports(data: Data): string[] {
    const importMap = new Map<string, { defaultImport?: string; namedImports: Map<string, boolean> }>();

    for (const node of data.imports.data)
    {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
        if (!importMap.has(moduleSpecifier))
        {
            importMap.set(moduleSpecifier, { namedImports: new Map() });
        }
        const entry = importMap.get(moduleSpecifier)!;

        if (node.importClause?.name)
        {
            entry.defaultImport = node.importClause.name.text;
        }

        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings))
        {
            const isTypeOnlyImport = node.importClause.isTypeOnly;
            for (const specifier of node.importClause.namedBindings.elements)
            {
                const name = specifier.name.text;
                const isTypeOnly = isTypeOnlyImport || specifier.isTypeOnly;
                if (!entry.namedImports.has(name) || entry.namedImports.get(name) === true)
                {
                    entry.namedImports.set(name, isTypeOnly);
                }
            }
        }
    }

    return Array.from(importMap.entries()).map(([source, { defaultImport, namedImports }]) => {
        const parts: string[] = [];
        if (defaultImport) parts.push(defaultImport);
        if (namedImports.size > 0)
        {
            const named = Array.from(namedImports.entries())
                .map(([name, isTypeOnly]) => isTypeOnly ? `type ${name}` : name)
                .join(', ');
            parts.push(`{ ${named} }`);
        }
        return `import ${parts.join(', ')} from "${source}";`;
    });
}

function writeFallbackOutput(
    printer: ts.Printer,
    data: Data,
    outputFile: string,
    externalReexports?: ts.ExportDeclaration[]
) {
    const exports = data.exports.data.map(({ node, sourceFile }) =>
        printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
    );

    const externalReexportStrings = (externalReexports || []).map(node =>
        printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    );

    const content = [
        externalReexportStrings.join("\n"),
        exports.join("\n")
    ].filter(Boolean).join("\n").trim();

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, (content || "export { };") + "\n");
}

function writeOutput(
    outputFile: string,
    commonImports: Set<string>,
    imports: string[],
    externalReexports: ts.ExportDeclaration[],
    printer: ts.Printer,
    filteredTypes: Array<{ node: ts.Node; sourceFile: ts.SourceFile }>,
    baseTypes: string[],
    exports: string[]
) {
    const externalReexportStrings = externalReexports.map(node =>
        printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    );

    const types = filteredTypes.map(({ node, sourceFile }) => {
        let printed = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
        const lines = printed.split('\n');
        for (let i = 0; i < lines.length; i++)
        {
            const line = lines[i].trim();
            if (/^export\s+/.test(line))
            {
                lines[i] = line.replace(/^export\s+/, '');
            }
        }
        return lines.join('\n');
    });

    const content = [
        commonImports.size > 0 ? `import type { ${Array.from(commonImports).join(", ")} } from "./types.d.ts";` : null,
        imports.length > 0 ? imports.join("\n").trim() : null,
        externalReexportStrings.length > 0 ? externalReexportStrings.join("\n").trim() : null,
        types.length > 0 ? "" : null,
        types.length > 0 ? types.reverse().join("\n").trim() : null,
        baseTypes.length > 0 ? baseTypes.join("\n").trim() : null,
        "",
        exports.reverse().join("\n").trim(),
    ].filter(v => v !== null).join("\n").trim();

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, (content || "export { };") + "\n");
}