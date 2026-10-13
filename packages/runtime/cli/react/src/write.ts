import fs from "node:fs";
import path from "node:path";

import { analysePackage } from "@papit/analyse";

import { generateReact, MARKER } from "./generate";

/** Options for `writeReact`. */
export type WriteReactOptions = {
    /**
     * Output file, relative to the package. Not `src/react.tsx`: under the packages' `baseUrl: "src"`
     * the bare `react` import would resolve to the file itself.
     * @default "src/react-wrapper.tsx"
     */
    output?: string;
};

const DEFAULT_OUTPUT = "src/react-wrapper.tsx";

/**
 * `skipped` when the file exists without the marker line, i.e. it was taken over by hand.
 * `stale` is a `src/react-wrapper.ts` next to the default output: `removed` when it was generated,
 * kept when taken over by hand (it then shadows the `.tsx`, as bundle-js resolves `.ts` first).
 */
export type WriteReactResult = {
    file: string;
    status: "written" | "skipped";
    stale?: { file: string; removed: boolean };
};

/**
 * Analyses the package at `location` in-process and writes its React wrappers.
 * An existing file is only overwritten while it still has the marker line, first or after the `"use client"` directive.
 * With the default output, a generated `src/react-wrapper.ts` from before the `.tsx` is deleted.
 */
export function writeReact(location: string, options: WriteReactOptions = {}): WriteReactResult {
    const file = path.resolve(location, options.output ?? DEFAULT_OUTPUT);

    if (fs.existsSync(file) && !generated(file)) return { file, status: "skipped" };

    const code = generateReact(analysePackage(location));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, code);

    const result: WriteReactResult = { file, status: "written" };

    // the .ts this file replaced: bundle-js would still pick it over the .tsx
    const stale = file.replace(/\.tsx$/, ".ts");
    if (file === path.resolve(location, DEFAULT_OUTPUT) && fs.existsSync(stale))
    {
        const removed = generated(stale);
        if (removed) fs.rmSync(stale);
        result.stale = { file: stale, removed };
    }

    return result;
}

/** Has the marker line, first or after the `"use client"` directive. */
function generated(file: string) {
    return fs.readFileSync(file, "utf8").split(/\r?\n/, 2).includes(MARKER);
}
