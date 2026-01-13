import fs from "node:fs";
import path from "node:path";
import { ServerResponse } from "node:http";

import { getURL } from "../http/url";
import { FileConstants } from "./types";
import { Cache } from "./cache";
import { streamFile } from "./stream";
import { NotFoundError } from "../errors";
import { Arguments } from "@papit/arguments";

export function getFILE(
  url: ReturnType<typeof getURL>,
  cache: Cache,
  res: ServerResponse,
  signal?: AbortSignal,
) {
  if (!fs.existsSync(url.absolute)) throw new NotFoundError(`${url.relative} not found`);

  // at this point we assume the url is not in the cache 
  const extname = path.extname(url.absolute);
  const stats = fs.statSync(url.absolute);
  if (!cache.isCacheable(stats.size, extname)) 
  {
    console.log('streamed', stats.size)
    streamFile(url.absolute, res, signal)
    return "streamed";
  }

  const mimeType = FileConstants.MimeTypes[extname] ?? "text/plain";
  const buffer = fs.readFileSync(url.absolute);
  const entry = { mimeType, buffer, mtime: stats.mtimeMs };

  if (!Arguments.has('no-cache')) 
  {
    return entry;
  }

  cache.add(url, buffer, mimeType, entry.mtime);
  return entry;
}