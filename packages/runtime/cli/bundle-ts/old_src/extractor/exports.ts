import ts from "typescript";
import path from "node:path";
import { getCanonicalSymbol } from "./helper";

// Use type, not interface
export type ExportMetadata = {
    alias?: string;           // export { FOO as BAR } -> alias="BAR", originalName="FOO"
    namespaceAlias?: string;  // export * as ns from "..." -> namespaceAlias="ns"
    originalName?: string;
    isStarReexport: boolean;  // came from export * from "..."
    sourceFile: string;       // where this export came from
};

// Simplified: just Map, no Set
type EntryData = Map<ts.Symbol, ExportMetadata>;

export function extractExports(
    checker: ts.TypeChecker,
    program: ts.Program,
    entrypoints: Record<'input' | 'output' | 'temp', string[]>,
    location: string,
    tempOutDir: string,
) {
    // Map<outputPath, Map<symbol, metadata>>
    const entrySymbols = new Map<string, EntryData>();
    const externalReexports = new Map<string, ts.ExportDeclaration[]>(); // Per-entry tracking

    for (let i = 0; i < entrypoints.temp.length; i++)
    {
        const file = entrypoints.temp[i];
        const output = entrypoints.output[i];
        const source = program.getSourceFile(file);
        if (!source) continue;

        const metadata = new Map<ts.Symbol, ExportMetadata>();
        const externalNodes: ts.ExportDeclaration[] = [];

        entrySymbols.set(output, metadata);
        externalReexports.set(output, externalNodes);

        extractSource(
            source,
            metadata,
            checker,
            program,
            location,
            tempOutDir,
            externalNodes,
            undefined, // no namespace for root
            new Set()
        );
    }

    // Count frequency across all entries
    const freq = new Map<ts.Symbol, number>();
    for (const [_output, metadata] of entrySymbols)
    {
        const seenCanonicals = new Set<ts.Symbol>(); // Track per entry

        for (const sym of metadata.keys())
        {
            const canonical = getCanonicalSymbol(checker, sym);

            // Only count once per entry, even if exported multiple times
            if (!seenCanonicals.has(canonical))
            {
                seenCanonicals.add(canonical);
                freq.set(canonical, (freq.get(canonical) ?? 0) + 1);
            }
        }
    }

    // Common = appears in 2+ entries
    const common = new Set(
        [...freq.entries()]
            .filter(([_, count]) => count >= 2)
            .map(([sym]) => sym)
    );

    // Make sure ALL entry points are in unique, even empty ones
    for (let i = 0; i < entrypoints.temp.length; i++) {
        const tempFile = entrypoints.temp[i];
        const outputFile = entrypoints.output[i];
        
        if (!entrySymbols.has(outputFile)) {
            entrySymbols.set(outputFile, new Map()); // Add empty entry
        }
    }

    // Unique = filter out common symbols from each entry
    const unique = new Map<string, EntryData>();
    for (const [output, metadata] of entrySymbols)
    {
        const uniqueMetadata = new Map<ts.Symbol, ExportMetadata>();
        for (const [sym, meta] of metadata)
        {
            const canonical = getCanonicalSymbol(checker, sym);
            if (!common.has(canonical))
            {
                uniqueMetadata.set(sym, meta);
            }
        }
        unique.set(output, uniqueMetadata);
    }

    return { unique, common, externalReexports };
}

function extractSource(
    source: ts.SourceFile,
    metadata: EntryData,
    checker: ts.TypeChecker,
    program: ts.Program,
    location: string,
    tempOutDir: string,
    externalNodes: ts.ExportDeclaration[],
    namespaceAlias: string | undefined,
    visited: Set<string>,
) {
    if (visited.has(source.fileName)) return;
    visited.add(source.fileName);

    const reexportInfo = extractReexports(source);
    const locationNormalized = path.resolve(location);

    // Check each star re-export
    for (const moduleSpecifier of reexportInfo.starSources)
    {
        const resolvedModule = resolveModuleSpecifier(moduleSpecifier, source.fileName, program, location, tempOutDir);
        if (!resolvedModule) continue;
        
        const resolvedNormalized = path.resolve(resolvedModule);
        if (!resolvedNormalized.startsWith(locationNormalized))
        {
            // External - find and save the node
            const node = reexportInfo.nodes.find(n =>
                !n.exportClause &&
                (n.moduleSpecifier as ts.StringLiteral).text === moduleSpecifier
            );
            if (node) externalNodes.push(node);
            continue;
        }

        // Internal - recurse
        if (visited.has(resolvedNormalized)) continue;
        const reexportSource = program.getSourceFile(resolvedModule);
        if (!reexportSource) continue;

        extractSource(reexportSource, metadata, checker, program, location, tempOutDir, externalNodes, namespaceAlias, visited);
    }

    // Check each namespace re-export
    for (const [alias, moduleSpecifier] of reexportInfo.namespaceExports)
    {
        const resolvedModule = resolveModuleSpecifier(moduleSpecifier, source.fileName, program, location, tempOutDir);
        if (!resolvedModule) continue;

        const resolvedNormalized = path.resolve(resolvedModule);
        if (!resolvedNormalized.startsWith(locationNormalized))
        {
            // External - find and save the node
            const node = reexportInfo.nodes.find(n =>
                ts.isNamespaceExport(n.exportClause!) &&
                (n.moduleSpecifier as ts.StringLiteral).text === moduleSpecifier
            );
            if (node) externalNodes.push(node);
            continue;
        }

        // Internal - recurse
        if (visited.has(resolvedNormalized)) continue;
        const reexportSource = program.getSourceFile(resolvedModule);
        if (!reexportSource) continue;

        extractSource(reexportSource, metadata, checker, program, location, tempOutDir, externalNodes, alias, visited);
    }

    // Check named re-exports from external modules
    for (const node of reexportInfo.nodes)
    {
        if (!node.moduleSpecifier) continue;
        if (!node.exportClause || !ts.isNamedExports(node.exportClause)) continue;
        
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
        const resolvedModule = resolveModuleSpecifier(moduleSpecifier, source.fileName, program, location, tempOutDir);
        
        // Only treat as external if we CAN resolve it AND it's outside location
        if (!resolvedModule) continue; // Can't resolve = skip (internal path alias)
        
        const resolvedNormalized = path.resolve(resolvedModule);
        if (!resolvedNormalized.startsWith(locationNormalized))
        {
            externalNodes.push(node); // Explicitly external
        }
    }

    // Get direct exports from this module
    const moduleSym = checker.getSymbolAtLocation(source);
    if (!moduleSym) return;

    for (const sym of checker.getExportsOfModule(moduleSym))
    {
        // FILTER: Skip symbols that originate from external modules
        const declarations = sym.getDeclarations() || [];
        const isExternal = declarations.some(decl => {
            const declFile = decl.getSourceFile().fileName;
            const declNormalized = path.resolve(declFile);
            return !declNormalized.startsWith(locationNormalized);
        });

        if (isExternal)
        {
            // This symbol comes from an external module - skip it
            // It's already covered by the "export * from" statement
            continue;
        }

        const symbolName = sym.getName();
        const aliasInfo = findExportAlias(source, symbolName);

        metadata.set(sym, {
            alias: aliasInfo?.alias,
            namespaceAlias: namespaceAlias,
            originalName: aliasInfo?.originalName,
            isStarReexport: reexportInfo.starSources.length > 0,
            sourceFile: source.fileName,
        });
    }
}

function findExportAlias(
    source: ts.SourceFile,
    symbolName: string
): { alias: string, originalName: string } | undefined {
    let result: { alias: string, originalName: string } | undefined;

    source.forEachChild(node => {
        if (!ts.isExportDeclaration(node)) return;
        if (!node.exportClause || !ts.isNamedExports(node.exportClause)) return;

        for (const element of node.exportClause.elements)
        {
            // export { FOO as BAR }
            // propertyName = "FOO" (original), name = "BAR" (alias)
            const originalName = element.propertyName?.text ?? element.name.text;
            const exportedName = element.name.text;

            if (symbolName === exportedName && element.propertyName)
            {
                result = { alias: exportedName, originalName };
                return;
            }
        }
    });

    return result;
}

function resolveModuleSpecifier(
    moduleSpecifier: string,
    containingFile: string,
    program: ts.Program,
    location: string,
    tempOutDir: string,
): string | undefined {
    const result = ts.resolveModuleName(
        moduleSpecifier,
        containingFile,
        program.getCompilerOptions(),
        ts.sys
    );

    if (!result.resolvedModule) return undefined;

    const resolvedPath = path.resolve(result.resolvedModule.resolvedFileName);
    const locationNormalized = path.resolve(location);

    // If external, return as-is
    if (!resolvedPath.startsWith(locationNormalized))
    {
        return resolvedPath;
    }

    // Internal file - map to temp equivalent
    // e.g., /location/src/b.ts -> /location/.temp/ts-bundle/src/b.d.ts
    const relativePath = path.relative(locationNormalized, resolvedPath);
    const tempPath = path.join(tempOutDir, relativePath)
        .replace(/\.tsx?$/, '.d.ts');

    // Verify it exists in the program
    if (program.getSourceFile(tempPath))
    {
        return tempPath;
    }

    // console.warn(`Temp file not found for ${resolvedPath}: ${tempPath}`);
    return undefined;
}

type ReexportInfo = {
    starSources: string[];
    namespaceExports: Map<string, string>;
    names: Set<string>;
    nodes: ts.ExportDeclaration[];
};

function extractReexports(sourceFile: ts.SourceFile): ReexportInfo {
    const starSources: string[] = [];
    const namespaceExports = new Map<string, string>();
    const names = new Set<string>();
    const nodes: ts.ExportDeclaration[] = [];

    sourceFile.forEachChild(node => {
        if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) return;

        nodes.push(node);
        const source = (node.moduleSpecifier as ts.StringLiteral).text;

        if (!node.exportClause)
        {
            // export * from "..."
            starSources.push(source);
        }
        else if (ts.isNamespaceExport(node.exportClause))
        {
            // export * as ns from "..."
            namespaceExports.set(node.exportClause.name.text, source);
        }
        else if (ts.isNamedExports(node.exportClause))
        {
            // export { a, b as c } from "..."
            for (const el of node.exportClause.elements)
            {
                names.add(el.name.text);
            }
        }
    });

    return { starSources, namespaceExports, names, nodes };
}
