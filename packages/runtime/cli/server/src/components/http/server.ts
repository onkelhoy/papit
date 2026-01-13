// import statements 
import http, { ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

import { Arguments, getJSON, getPathInfo, LocalPackage, Terminal } from "@papit/util";
import { executor } from "@papit/build";

// components
import { HttpError, MethodNotAllowedError } from "../errors";
import { streamAsset, Translation } from "../asset";
import { getHTML } from "../html/html";

// local imports 
import { upgrade } from "./socket";
import { getPort } from "./port";
import { bundler } from "../file/bundler";
// import { handleRequest } from "./request";
import { getURL } from "./url";
import { Cache } from "../file/cache";
import { getFILE } from "../file/get";

let PORT = Number(Arguments.args.flags.port || 3000);

export let server: null | http.Server = null;

export async function start(
    info: ReturnType<typeof getPathInfo>,
    translations: Record<string, Translation>,
    assets: Record<string, string[]>,
    packageJSON: LocalPackage,
    importmap: { imports: Record<string, string> },
) {
    PORT = await getPort(PORT);
    server = http.createServer();

    const lockfile = getJSON

    const filecache = new Cache("file");
    filecache.maxSize = Arguments.number("cache-file") ?? 50; // MB
    const htmlcache = new Cache("html");
    htmlcache.maxSize = Arguments.number("cache-html") ?? 50; // MB
    const bundlecache = new Cache("bundle");
    bundlecache.maxSize = Arguments.number("cache-bundle") ?? 150; // MB

    if (packageJSON.name !== "@papit/server" && !Arguments.args.flags.serve)
    {
        if (Arguments.info) Terminal.write(Terminal.blue("listening to file changes"), packageJSON.name)
        Arguments.args.flags['no-bundle'] = true;
        Arguments.args.flags.live = true;
        Arguments.args.flags.location = info.package;
        Arguments.args.flags.mode = "dev";
        Arguments.args.flags.buildMode = "ancestors";

        executor({
            callback(counter, result) {
                console.log('rebuild')
            },
        });
    }

    server.listen(PORT, () => {
        Arguments.args.flags.port = String(PORT);
        if (!Arguments.silent) Terminal.write("server:", Terminal.blue(String(PORT)), Terminal.yellow("- running"));
    });

    // events 
    server.on("request", async (req, res) => {
        try 
        {
            if (req.method !== "GET") 
            {
                res.setHeader("Allow", "GET");
                throw new MethodNotAllowedError();
            }

            if (req.url?.startsWith("/.well-known"))
            {
                return res.end("ok");
            }


            if (req.url === "/favicon.ico")
            {
                req.url = "/favicon.svg";
            }

            const url = getURL(req, info);

            try 
            {
                // we assume asset by this point 
                const asset = await streamAsset(
                    req.url!,
                    translations,
                    assets,
                    filecache,
                    res,
                ); // this will throw if failed 

                if (asset === "streamed") return;

                res.statusCode = 200;
                res.setHeader('Content-Type', asset.mimeType);
                res.end(asset.buffer);
                return;
            }
            catch { }

            const cached = htmlcache.get(url) ?? bundlecache.get(url) ?? filecache.get(url);

            if (cached)
            {
                if (Arguments.info) Terminal.write(Terminal.yellow(url.relative), "found in cache")
                res.statusCode = 200;
                res.setHeader('Content-Type', cached.mimeType);
                res.setHeader('X-Cache', "HIT");
                return res.end(cached.buffer);
            }

            res.setHeader('X-Cache', "MISS");

            const stat = fs.statSync(url.absolute);
            if (stat.isDirectory() || path.extname(url.absolute) === ".html")
            {
                const document = await getHTML(url, assets, importmap, info.script!, htmlcache);
                res.statusCode = 200;
                res.end(document.outerHTML);
                return;
            }

            if (/\.tsx?/.test(url.absolute) && (req.headers.referer?.endsWith(".js") || req.headers['sec-fetch-dest'] === "script"))
            {
                // we put this into its own cache (bundlecache)
                const bundle = await bundler(url, bundlecache);
                console.log('bundle?', url, bundle)
                res.statusCode = 200;
                res.setHeader('Content-Type', "text/javascript");
                res.end(bundle);
                return;
            }

            const file = getFILE(url, filecache, res);
            if (file === "streamed") return;
            res.statusCode = 200;
            res.setHeader('Content-Type', file.mimeType);
            res.end(file.buffer);
        }
        catch (e) { handleError(e, res) }
    });

    server.on('error', (error: Error) => {
        if (Arguments.error) Terminal.error(error.name, error.message, error.stack ?? "");
    });

    // socket related
    server.on('upgrade', upgrade);
}

export function close() {
    server?.close();
    if (!Arguments.silent) Terminal.write("server:", Terminal.blue(String(PORT)), Terminal.yellow("- shutdown"));
}

function handleError(e: unknown, res: ServerResponse) {
    if (Arguments.error) console.trace(e);

    if (e instanceof HttpError)
    {
        res.statusCode = e.status;
    }
    else 
    {
        res.statusCode = 500;
    }

    if (typeof e === "string")
    {
        res.write(e);
    }
    else if (e && typeof e === "object" && "message" in e)
    {
        res.write(e.message);
    }
    else 
    {
        res.write("something went wrong");
    }

    res.end();
}