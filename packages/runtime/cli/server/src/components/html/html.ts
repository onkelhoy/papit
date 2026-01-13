import path from "node:path";
import fs from "node:fs";

import { createExplorer } from "./explorer";
import { createInline } from "./inline";
import { Cache } from "../file/cache";
import { getPACKAGE, getURL } from "../http/url";
import { FileConstants } from "../file/types";

export async function getHTML(
  url: ReturnType<typeof getURL>,
  assets: Record<string, string[]>,
  importmap: { imports: Record<string, string> },
  devServerScript: string,
  cache: Cache,
) {
  const node = getPACKAGE(url);
  const htmlURL = url.absolute.endsWith(".html") ? url : { absolute: path.join(url.absolute, "index.html"), relative: path.join(url.relative, "index.html") };

  let document, mtime = null;
  if (fs.existsSync(htmlURL.absolute))
  {
    const stat = fs.statSync(htmlURL.absolute);
    mtime = stat.mtimeMs;
    document = createInline(htmlURL, importmap, devServerScript);
  }
  else 
  {
    const FFs = fs.readdirSync(url.absolute);
    document = createExplorer(node, FFs, url, devServerScript);
  }

  cache.add(
    url,
    Buffer.from(document.innerHTML, "utf8"),
    FileConstants.MimeTypes[".html"],
    mtime,
  );

  return document;
}