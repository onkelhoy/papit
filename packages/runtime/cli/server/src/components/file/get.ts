import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ServerResponse } from "node:http";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

import { getURL } from "components/http/url";
import { NotFoundError } from "components/errors";

import { FileConstants } from "./types";
import { Cache } from "./cache";
import { streamFile } from "./stream";
import { rewriteCssImports } from "./css";
import type { Importmap } from "components/importmap/types";

export function getFILE(
    url: ReturnType<typeof getURL>,
    cache: Cache,
    res: ServerResponse,
    signal?: AbortSignal,
    importmap?: Importmap,
    themes?: Map<string, string>,
) {
    if (!fs.existsSync(url.absolute)) throw new NotFoundError(`${url.relative} not found`);

    // at this point we assume the url is not in the cache 
    const extname = path.extname(url.absolute);
    const stats = fs.statSync(url.absolute);
    if (!cache.isCacheable(stats.size, extname)) 
    {
        streamFile(url.absolute, res, signal)
        return "streamed";
    }

    const mimeType = FileConstants.MimeTypes[extname] ?? "text/plain";
    let buffer = fs.readFileSync(url.absolute);

    // browsers don't use the import map for CSS, so bare @imports point at the mapped file
    if (extname === ".css" && importmap)
    {
        const result = rewriteCssImports(buffer.toString("utf-8"), specifier => {
            if (fs.existsSync(path.join(path.dirname(url.absolute), specifier))) return null;
            // themes are served by package name, see the theme lookup in server.ts
            const theme = themes?.get(specifier);
            if (theme) return pathToFileURL(theme).pathname;
            return importmap.imports[specifier];
        });
        for (const specifier of result.unresolved)
        {
            Terminal.warn("unresolved @import", `"${specifier}"`, "in", url.relative);
        }
        buffer = Buffer.from(result.css);
    }

    const entry = { mimeType, buffer, mtime: stats.mtimeMs };

    if (!Arguments.has('no-cache')) 
    {
        return entry;
    }

    cache.add(url, buffer, mimeType, entry.mtime);
    return entry;
}