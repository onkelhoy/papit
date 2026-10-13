import { analyseCode } from "./code";
import { analyse } from "./package";
import type { AnalysePackageOptions, Core, PackageAnalysis } from "./types";

export * from "./types";

/**
 * Analyses one source file: every class in it with an `extends` clause, plus the stylesheets it imports.
 * The parent is left as a `Reference` (class name + import source); `analysePackage` follows it.
 */
export function analyseFile(file: string): Core[] {
    return analyseCode(file);
}

/**
 * Analyses a package: finds every exported custom element class from its package.json
 * entry points and follows `extends` up the chain, into other packages too (workspace first, then node_modules).
 * Stops at built-ins; a parent it can't resolve stays a `Reference`. With `reuse`, a dependency's
 * analyse.json is used when newer than its src, and always when installed in node_modules.
 */
export function analysePackage(location: string, options: AnalysePackageOptions = {}): PackageAnalysis {
    return analyse(location, options);
}
