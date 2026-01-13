import fs from "node:fs";
import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information } from "@papit/information";
import { Document } from "@papit/html";

(async function () {
    const input = Arguments.get("input").at(0) ?? Information.local;
    const output = Arguments.get("output").at(0) ?? path.join(input, "spritesheet.svg");
    const namequery = Arguments.get("name-query").at(0) ?? "title";

    if (!input || !fs.existsSync(input))
    {
        Terminal.error("you must provide a valid input", String(input));
        process.exit(1);
    }

    const svgfiles = fs.readdirSync(input).map(name => path.join(input, name)).filter(loc => fs.statSync(loc).isFile() && path.extname(loc) === ".svg");
    const document = new Document();
    document.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" />'
    const svgElement = document.documentElement!;

    for (let i = 0; i < svgfiles.length; i++)
    {
        const url = svgfiles[i];
        if (Arguments.info) 
        {
            Terminal.createSession();
            Terminal.write("reading svg", i + 1, "/", svgfiles.length);
        }

        const content = fs.readFileSync(url, { encoding: "utf-8" });

        if (Arguments.info) 
        {
            Terminal.clearSession();
            Terminal.write("reading svg", i + 1, "/", svgfiles.length, ".");
        }

        const filename = path.basename(url).replace(".svg", "");
        const svg = new Document();
        svg.innerHTML = content;

        if (Arguments.info) 
        {
            Terminal.clearSession();
            Terminal.write("reading svg", i + 1, "/", svgfiles.length, "..");
        }

        const name = (namequery ? svg.querySelector(namequery)?.textContent : typeof svg.getAttribute("id") === "string" ? svg.getAttribute("id") as string : undefined) ?? filename;

        const currentDocumentElement = svg.documentElement;
        if (!currentDocumentElement) 
        {
            Terminal.clearSession();
            Terminal.warn(name, Terminal.red("failed"));
            Terminal.createSession();
            continue;
        }

        const symbol = document.createElement("symbol");
        symbol.id = name;

        currentDocumentElement.attributes.forEach((value, key) => {
            if (typeof value !== "string") return;
            if (/xmlns/i.test(key)) return;
            symbol.setAttribute(key, value);
        });

        if (Arguments.info) 
        {
            Terminal.clearSession();
            Terminal.write("reading svg", i + 1, "/", svgfiles.length, "...");
        }

        currentDocumentElement.children.forEach(node => symbol.appendChild(node));

        // append the current svg into our document svg (extract content based on contentquery if exist)
        svgElement.appendChild(symbol);

        if (Arguments.info) 
        {
            Terminal.clearSession();
            Terminal.write(name, Terminal.green("added"));
            Terminal.createSession();
        }
    }

    const dirname = path.dirname(output);
    fs.mkdirSync(dirname, { recursive: true });

    try { fs.rmSync(output) }
    catch { }

    fs.writeFileSync(output, document.innerHTML, { encoding: "utf-8" });

    Terminal.write(Terminal.green("spritesheet created"), `[${output}]`);
})()