import { Terminal } from "@papit/terminal";

import type { ShowcaseSource } from "./types";

/**
 * Runs `npm run analyse` in every package that has the script, one at a time.
 * A failing package is reported and skipped, never thrown. Returns the names that failed.
 */
export async function runAnalyse(sources: ShowcaseSource[], log = true) {
    const failed: string[] = [];

    for (const source of sources)
    {
        if (!source.packageJSON.scripts?.analyse) continue;

        try
        {
            await Terminal.execute("npm run analyse --silent", source.location);
        }
        catch (error)
        {
            failed.push(source.name);
            if (log) Terminal.warn("analyse failed for", source.name, "-", error instanceof Error ? error.message.split("\n")[0] : String(error));
        }
    }

    return failed;
}
