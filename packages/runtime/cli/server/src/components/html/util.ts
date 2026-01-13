import { Document } from "@papit/html";
import path from "node:path";
import fs from "node:fs";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

export function getDocument(name: string, devServerScript: string) {
  const document = new Document();
  const nameTemplate = `${name}-template`;
  let source = path.join(devServerScript, `asset/templates/${name}/index.html`);

  const value = Arguments.string(nameTemplate);
  if (value && fs.existsSync(value))
  {
    source = value;
  }

  if (!fs.existsSync(source))
  {
    if (Arguments.error) Terminal.error(`could not find ${name} template html file`);
    document.innerHTML = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>@papit/server</title><meta name="description" content="Development server" /><meta name="color-scheme" content="light dark" /></head><body>Llama Trauma Baby Mama</body></html>`;
    return document;
  }

  const content = fs.readFileSync(source, { encoding: "utf-8" });
  document.innerHTML = content;

  return document;
}