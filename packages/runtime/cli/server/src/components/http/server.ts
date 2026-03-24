// import statements 
import http, { ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

import { Information, PackageNode } from "@papit/information";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

// components
import { HttpError, MethodNotAllowedError } from "components/errors";
import { streamAsset, type Translations } from "components/asset";
import { getHTML } from "components/html/html";

// local imports 
import { bundler } from "components/file/bundler";
import { Cache } from "components/file/cache";
import { getFILE } from "components/file/get";

import { update as socketUpdate, upgrade } from "./socket";
import { getPort } from "./port";
import { getPACKAGE, getURL } from "./url";
import { build } from "@papit/build";

let PORT = Arguments.number("port") || 3000;
export let server: null | http.Server = null;

export function start(
    serverPackageLocation: string,
    translations: Translations,
    assets: Record<string, string[]>,
    importmap: { imports: Record<string, string> },
    themes: Map<string, string>,
) {
    PORT = Arguments.number("port") || 3000;

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


        if (!Arguments.has("prod")) live();

        if (Information.packageName !== "@papit/server" && !Arguments.has("serve"))
        {
            if (Arguments.info) Terminal.write(Terminal.blue("listening to file changes"), Information.package.name);

            Arguments.set("no-bundle", true);
            Arguments.set("live", true);
            Arguments.set("location", Information.package.location);
            Arguments.set("mode", "dev");
            Arguments.set("buildMode", "ancestors");
        }

        server.listen(PORT, () => {
            Arguments.set("port", PORT);
            if (!Arguments.silent) Terminal.write("server:", Terminal.blue(PORT), Terminal.yellow("- running"));
            if (Arguments.has("open"))
            {
                const url = path.join(`http://localhost:${PORT}`, path.relative(Information.root.location, Information.package.location));
                const joined = path.join(url, Arguments.string("open") ?? Arguments.string("folder") ?? "");
                switch (process.platform)
                {
                    case "win32": Terminal.execute(`start "${joined}"`, url); break;
                    case "darwin": Terminal.execute(`open "${joined}"`, url); break;
                    case "linux": Terminal.execute(`xdg-open "${joined}"`, url); break;
                }
            }
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

                if (req.url?.endsWith("/favicon.ico"))
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

                const packageName = req.url?.split("@")?.at(1);
                if (packageName)
                {
                    const url = themes.get("@" + packageName);
                    if (url)
                    {
                        const file = getFILE({ absolute: url, relative: path.relative(Information.root.location, url) }, filecache, res);
                        if (file === "streamed") return;

                        res.statusCode = 200;
                        res.setHeader('Content-Type', file.mimeType);
                        res.end(file.buffer);
                        return;
                    }
                }

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

                    if (!Arguments.has("prod"))
                    {
                        res.setHeader('Cache-Control', 'no-store');
                    }

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
    if (Arguments.error) console.trace("[SERVER]", e);

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

function live() {
    const watcher = chokidar.watch(Information.root.location, {
        ignored: (filePath: string) => {
            return (
                filePath.includes("/node_modules/") ||
                filePath.includes("/.temp/") ||
                filePath.includes("/.vscode/") ||
                filePath.includes("/.github/") ||
                filePath.includes("/lib/")
            );
        },
        // ignoreInitial: true, // BUG IN CHOKIDAR WITH "followSymlinks"
        persistent: true,
        followSymlinks: false
    });

    let chokidarready = false;
    watcher.on("ready", () => { chokidarready = true; });

    let isBuilding = false;

    const runBuild = async (node: PackageNode) => {
        isBuilding = true;
        try
        {
            await build(Arguments.instance, node, (_, info) => {
                if (info === "success")
                {
                    if (Arguments.info) Terminal.write(Terminal.blue("rebuilt"), node.name);
                    socketUpdate(node);
                }
                else if (info === "skipped")
                {
                    if (Arguments.info) Terminal.write(Terminal.blue("skipped"), node.name);
                }
                else 
                {
                    if (Arguments.info) Terminal.error(node.name);
                }
            });
        }
        catch (e)
        {
            if (Arguments.error) Terminal.error(e);
        }
        finally 
        {
            isBuilding = false;
        }
    }

    watcher.on("all", (event, filePath, stats) => {
        if (!chokidarready) return;
        if (isBuilding) return;

        const url = { absolute: filePath, relative: path.relative(Information.root.location, filePath) };
        const packageNode = getPACKAGE(url);

        if (url.relative.includes(packageNode.sourceFolder + "/"))
        {
            runBuild(packageNode);
        }
        else 
        {
            socketUpdate(packageNode);
        }

        if (Arguments.debug)
        {
            console.log("SERVER LIVE RELOAD", {
                url,
                package: {
                    name: packageNode.name,
                    location: packageNode.location,
                    src: packageNode.sourceFolder,
                },
                includes: url.relative.includes(packageNode.sourceFolder + "/")
            })
        }
    });
}