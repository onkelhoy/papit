import fs from "node:fs";
import path from "node:path";
import type { BuildResult, BuildContext } from "esbuild";

import { jsBundle, jsWatch } from "@papit/bundle-js";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

import { getPACKAGE, getURL } from "../http/url";
import { error, update } from "../http/socket";
import { InternalServerError, NotFoundError } from "../errors";
import { Cache } from "./cache";
import { FileConstants } from "./types";

const watchContexts = new Map<string, Awaited<ReturnType<typeof jsWatch>>>();

export async function bundler(url: ReturnType<typeof getURL>, cache: Cache) {
    const node = getPACKAGE(url);

    if (!Arguments.has("prod") && !watchContexts.has(url.absolute))
    {
        const watcher = await jsWatch(
            Arguments.instance,
            node.location,
            {
                entryPointArray: [{ input: url.absolute, output: undefined }],
                tsconfig: node?.tsconfig,
                externals: node?.externals,
                packageJSON: node?.packageJSON,
                esoptions: { write: false },
            },
            (info) => {
                if (info.type !== "build" && info.type !== "rebuild") return;
                if (info.result.errors.length > 0) return void error(url.absolute, info.result.errors);
                const content = info.result.outputFiles?.at(0)?.text;
                if (content)
                {
                    cache.add(url, Buffer.from(content, "utf8"), FileConstants.MimeTypes[".js"], null);
                    update(url.absolute, "");
                }
            }
        );
        watchContexts.set(url.absolute, watcher);
    }

    // initial bundle (or non-live)
    let content: string | undefined;
    await jsBundle(
        Arguments.instance,
        node.location,
        {
            entryPointArray: [{ input: url.absolute, output: undefined }],
            tsconfig: node?.tsconfig,
            externals: node?.externals,
            packageJSON: node?.packageJSON,
            esoptions: { write: false },
        },
        (info) => {
            if (info.type === "build") content = info.result.outputFiles?.at(0)?.text;
        }
    );

    if (!content) throw new NotFoundError("file not found: " + url.relative);
    cache.add(url, Buffer.from(content, "utf8"), FileConstants.MimeTypes[".js"], fs.statSync(url.absolute)?.mtimeMs ?? null);
    return content;
}

// export async function bundler(
//     url: ReturnType<typeof getURL>,
//     cache: Cache
// ) {
//     const node = getPACKAGE(url);

//     // const bundle = await jsBundle(
//     //     url.absolute,
//     //     undefined,
//     //     node,
//     //     Arguments.instance,
//     //     false,
//     //     (counter, result) => {
//     //         if (counter === 1) return; // in live mode we called the build once before 

//     //         if (result.errors.length > 0)
//     //         {
//     //             return void error(url.absolute, result.errors);
//     //         }
//     //         const content = result.outputFiles?.at(0)?.text;
//     //         if (content)
//     //         {
//     //             cache.add(
//     //                 url,
//     //                 Buffer.from(content, "utf8"),
//     //                 FileConstants.MimeTypes[".js"],
//     //                 null,
//     //             );

//     //             return void update("/" + url.relative, "");
//     //         }
//     //     }
//     // );

//     let content: string | undefined;
//     if (!Arguments.has("prod")) Arguments.instance.set("live", true);

//     await jsBundle(
//         Arguments.instance, 
//         url.absolute,
//         {
//             entryPointArray: [{ input: url.absolute, output: undefined }],
//             tsconfig: node.tsconfig,
//             externals: node.externals,
//             packageJSON: node.packageJSON,
//             esoptions: { write: false, }
//         },
//         info => {
//             if (info.type === "build") {
//                 content = info.result.outputFiles?.at(0)?.text;
//             }
//         }
//     );

//     if (!content) throw new NotFoundError("file not found: " + url.relative);

//     cache.add(url, Buffer.from(content, "utf8"), FileConstants.MimeTypes[".js"], fs.statSync(url.absolute)?.mtimeMs ?? null);
//     return content;

//     // if (bundle === "skipped")
//     // {

//     //     return;
//     // }

//     // let result: BuildResult;
//     // if (Arguments.has("live"))
//     // {
//     //     // we should store the context so we can dispose of it?
//     //     const context = bundle as BuildContext;
//     //     result = await context.rebuild(); // we call the rebuild so we can return on this call 
//     //     // should we do something with it?
//     // }
//     // else 
//     // {
//     //     result = bundle as BuildResult;
//     // }

//     // if (result.errors.length > 0)
//     // {
//     //     if (Arguments.error) Terminal.error("something went wrong to bundle file", result.errors);
//     //     throw new InternalServerError("something went wrong to bundle file: " + url.relative);
//     // }

//     // const content = result.outputFiles?.at(0)?.text;
//     // if (content) 
//     // {
//     //     cache.add(
//     //         url,
//     //         Buffer.from(content, "utf8"),
//     //         FileConstants.MimeTypes[".js"],
//     //         fs.statSync(url.absolute)?.mtimeMs ?? null,
//     //     );

//     //     return content;
//     // }

//     // throw new NotFoundError("file not found: " + url.relative);
// }