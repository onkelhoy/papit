import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

export type PackageJson = {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    papit?: {
        type: string,
    }

    bin?: Record<string, string>;
    main?: string;
    types?: string;
    type: "module" | "commonjs";
    entryPoints?: string | Record<string, string>;
    exports?: string | Partial<Record<"." | (string & {}), string | Partial<Record<"import" | "types" | "require" | (string & {}), string>>>>;
}

export function getArguments() {
    const args = new Set<string>();
    for (let arg of process.argv.slice(2))
    {
        args.add(arg.replace(/^--/, ""));
    }

    return args;
}

export function getExternals(packageJSON: PackageJson) {

    return [
        packageJSON.dependencies,
        packageJSON.devDependencies,
        packageJSON.peerDependencies
    ]
        .filter(dep => dep !== undefined)
        .flatMap(dep => Object.keys(dep));
}

export function getTSlocation(
    args: { has: (key: string) => boolean },
    location: string,
) {
    let tsconfigLocation = path.join(location, "tsconfig.json");
    
    if (args.has("prod"))
    {
        const prodloc = path.join(location, "tsconfig.prod.json");
        if (fs.existsSync(prodloc)) tsconfigLocation = prodloc;
    }
    // else 
    // {
    //     // we assume dev
    //     const devloc = path.join(location, "tsconfig.dev.json");
    //     if (fs.existsSync(devloc)) tsconfigLocation = devloc;
    // }

    return tsconfigLocation;
}

export function getTSconfig(
    args: { has: (key: string) => boolean },
    location: string,
    tsconfigLocation?: string,
) {
    const url = tsconfigLocation ?? getTSlocation(args, location);
    const configFile = ts.readConfigFile(url, ts.sys.readFile);
    if (configFile.error)
    {
        throw new Error(`Error reading tsconfig: ${configFile.error.messageText}`);
    }

    return ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(url)
    );
}

export function outFolder(
    location: string,
    tsconfig: ts.ParsedCommandLine,
) {
    return path.relative(location, tsconfig.options.outDir ?? path.dirname(tsconfig.options.outFile ?? "") ?? path.join(location, "lib"))
}

export function sourceFolder(
    location: string,
    tsconfig: ts.ParsedCommandLine,
) {
    return path.relative(location, tsconfig.options.baseUrl ?? path.join(location, "src"))
}
