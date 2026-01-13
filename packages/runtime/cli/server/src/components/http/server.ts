// import statements 
import http, { ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

// import { Arguments, getJSON, getPathInfo, LocalPackage, Terminal } from "@papit/util";
// import { executor } from "@papit/build";

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
import { Information } from "@papit/information";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

let PORT = Arguments.number("port") || 3000;
export let server: null | http.Server = null;

export function start(
    serverPackageLocation: string,
    translations: Record<string, Translation>,
    assets: Record<string, string[]>,
    importmap: { imports: Record<string, string> },
) {
    PORT = Arguments.number("port") || 3000
    return new Promise<void>(async (resolve) => {

        PORT = await getPort(PORT);
        server = http.createServer();
        // const lockfile = getJSON

        const filecache = new Cache("file");
        filecache.maxSize = Arguments.number("cache-file") ?? 50; // MB
        const htmlcache = new Cache("html");
        htmlcache.maxSize = Arguments.number("cache-html") ?? 50; // MB
        const bundlecache = new Cache("bundle");
        bundlecache.maxSize = Arguments.number("cache-bundle") ?? 150; // MB

        if (Information.name !== "@papit/server" && !Arguments.has("serve"))
        {
            if (Arguments.info) Terminal.write(Terminal.blue("listening to file changes"), Information.package.name);
            
            Arguments.set("no-bundle", true);
            Arguments.set("live", true);
            Arguments.set("location", Information.package.location);
            Arguments.set("mode", "dev");
            Arguments.set("buildMode", "ancestors");

            // executor({
            //     callback(counter, result) {
            //         console.log('rebuild')
            //     },
            // });
        }

        server.listen(PORT, () => {
            Arguments.set("port", PORT);
            if (!Arguments.silent) Terminal.write("server:", Terminal.blue(PORT), Terminal.yellow("- running"));
            resolve();
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

                try 
                {
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

                const url = getURL(req);
                const stat = fs.statSync(url.absolute);

                // we have to check for a file so cache can be happy, otherwise it fails to do stat lookup and thus fails to give cache file
                if (stat.isDirectory()) 
                {
                    const potential = path.join(url.absolute, "index.html");
                    if (fs.existsSync(potential))
                    {
                        url.absolute = potential;
                        url.relative = path.join(url.relative, "index.html");
                    }
                }
                
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

                if (stat.isDirectory() || path.extname(url.absolute) === ".html")
                {
                    const document = await getHTML(url, assets, importmap, serverPackageLocation, htmlcache);
                    res.statusCode = 200;
                    res.end(document.outerHTML);
                    return;
                }

                if (/\.tsx?/.test(url.absolute) && (req.headers.referer?.endsWith(".js") || req.headers['sec-fetch-dest'] === "script"))
                {
                    // we put this into its own cache (bundlecache)
                    const bundle = await bundler(url, bundlecache);
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
    });
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