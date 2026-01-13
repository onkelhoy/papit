import fs from "node:fs";
import { Document, Element, Node } from "@papit/html";

import { getDocument } from "./util";
import { getURL } from "../http/url";
import { Terminal } from "@papit/terminal";

export function createInline(
  url: ReturnType<typeof getURL>,
  importmap: { imports: Record<string, string> },
  devServerScript: string,
) {
  const document = getDocument("live", devServerScript)
  if (!document.body) 
  {
    Terminal.error("live document template is missing body");
    process.exit(1);
  }

  if (!document.head) 
  {
    Terminal.error("live document template is missing head");
    process.exit(1);
  }

  const sourceDocument = new Document();
  const source = fs.readFileSync(url.absolute, { encoding: "utf-8" });
  sourceDocument.innerHTML = source;

  if (sourceDocument.head)
  {
    sourceDocument.head.childNodes.forEach(node => appendNode(node, document.head!));
  }

  if (sourceDocument.body)
  {
    sourceDocument.body.childNodes.forEach(node => appendNode(node, document.body!));
  }

  const firstScriptTag = document.head.querySelector("script");
  let importmapScript = document.head.querySelector('script[type="importmap"]');

  if (!importmapScript)
  {
    importmapScript = document.createElement("script");
    importmapScript.setAttribute("type", "importmap");
  }

  const _importmap = JSON.parse(importmapScript.textContent || "{}");
  if (!_importmap.imports) _importmap.imports = {};

  _importmap.imports = {
    ..._importmap.imports,
    ...importmap.imports,
  };

  importmapScript.textContent = JSON.stringify(_importmap);

  if (firstScriptTag)
  {
    if (firstScriptTag !== importmapScript)
      document.head.insertBefore(importmapScript, firstScriptTag);
    // else we dont have to do anything 
  }
  else 
  {
    document.head.appendChild(importmapScript);
  }

  return document;
}

function appendNode(node: Node, target: Element) {
  // check if element exist? (maybe append will work swell? 2 titles and it takes the latest?)
  if (node instanceof Element)
  {
    const query = `${node.tagName}${node.className ? "." + node.className : ""}${node.id ? "#" + node.id : ""}${Array.from(node.attributes).map(([key, value]) => `[${key}${typeof value === "string" ? `="${value}"` : ""}]`).join("")}`;

    const child = target.querySelector(query);
    if (child)
    {
      target.replaceChild(node, child)
      return;
    }
  }

  target.appendChild(node);
}