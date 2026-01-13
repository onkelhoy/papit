// import { Arguments, getPathInfo, LocalPackage, Terminal } from "@papit/util";
import { getDocument } from "./util";
import { Document } from "@papit/html";

import path from "node:path";
import fs from "node:fs";
import { getURL } from "../http/url";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { PackageNode } from "@papit/information";

export function createExplorer(
    node: PackageNode,
  FFs: string[],
  url: ReturnType<typeof getURL>,
  devServerScript: string,
) {
  const document = getDocument("explorer", devServerScript);

    document.title = node.packageJSON.name

  const spritesheet_source = Arguments.string("explorer-spritesheet") ?? path.join(devServerScript, "asset/icons/explorer-spritesheet.svg");
  const spritesheet_content = fs.readFileSync(spritesheet_source, { encoding: "utf-8" });
  const spritesheet_dom = new Document();
  spritesheet_dom.innerHTML = spritesheet_content;
  if (!spritesheet_dom.documentElement) 
  {
    Terminal.error("something went wrong loading explorer icon spritesheet");
    process.exit(1);
  }
  spritesheet_dom.documentElement.setAttribute("style", "display:none");

  document.body?.appendChild(spritesheet_dom.documentElement);

  // NOTE nt step is to make sire the "data-location" shou
  const location = document.querySelector("[data-location]")!;
  const relative = path.relative(node.location, url.absolute);
  if (relative) location.innerHTML = relative
  else location.parentElement?.removeChild(location);

  const folders = document.querySelector("ul[data-folders]")!;
  const files = document.querySelector("ul[data-files]")!;

  if (url.relative !== "")
  {
    folders.innerHTML = `<li class="hidden"><a href=".."><svg><use href="#folder" /></svg><span class="name">..</span></a></li>`;
  }

  FFs.sort((a, b) => a.localeCompare(b)).forEach(name => {
    const _url = path.join(url.absolute, name);

    const stat = fs.statSync(_url);
    const li = document.createElement("li");
    li.innerHTML = `<a href="${name}"><svg><use href="" /></svg><span class="name">${name}</span></a>`;


    const anchor = li.querySelector("a")!;
    const use = anchor.querySelector("use");

    if (!name.startsWith(".env") && !name.startsWith(".git") && name.startsWith(".")) 
    {
      li.classList.add("hidden");
    }

    if (stat.isFile())
    {
      use?.setAttribute("href", "#" + getFileIcon(_url, spritesheet_dom));

      files.appendChild(li);
      return;
    }

    if (stat.isDirectory())
    {
      use?.setAttribute("href", "#" + getFolderIcon(_url, spritesheet_dom));
      anchor.setAttribute("href", name + "/");

      folders.appendChild(li);
    }
  });

  return document;
}


function getFileIcon(url: string, spritesheet_dom: Document) {
  const basename = path.basename(url);
  const split = basename.split(".");
  if (basename.startsWith(".")) split.shift();
  const filename = split.at(0) ?? basename;

  let icon;
  if (basename.startsWith(".git") || /\.git/.test(url)) icon = "git";
  else if (basename === "package.json") icon = "package";
  else if (basename.startsWith("tsconfig")) icon = "tsconfig"
  else if (filename.startsWith("eslint")) icon = "eslint"
  else if (/translation/.test(url))
  {
    if (spritesheet_dom.querySelector("symbol#" + filename)) return filename; // language flag 
    icon = "language";
  }
  else if (/\.vscode/.test(url))
  {
    icon = "vscode";
  }

  if (spritesheet_dom.querySelector("symbol#" + icon)) return icon;

  const twolast = split.slice(split.length - 2).join("_");
  if (spritesheet_dom.querySelector("symbol#" + twolast)) return twolast;

  const ext = split.pop() ?? basename;
  if (spritesheet_dom.querySelector("symbol#" + ext)) return ext;

  return "file"; // fallback
}

function getFolderIcon(url: string, spritesheet_dom: Document) {
  return "folder";
}