import fs from "node:fs";

import { jsBundle } from "@papit/bundle-js";
import { Arguments } from "@papit/arguments";

import { getPACKAGE, getURL } from "components/http/url";
import { error, update } from "components/http/socket";
import { NotFoundError } from "components/errors";

import { Cache } from "./cache";
import { FileConstants } from "./types";

// const watchContexts = new Map<string, Awaited<ReturnType<typeof jsWatch>>>();

export async function bundler(url: ReturnType<typeof getURL>, cache: Cache) {
    const node = getPACKAGE(url);

    //  && !Arguments.has("serve")
    // if (!Arguments.has("prod") && !watchContexts.has(url.absolute))
    // {
    // const watcher = await jsWatch(
    //     Arguments.instance,
    //     node.location,
    //     {
    //         entryPointArray: [{ input: url.absolute, output: undefined }],
    //         tsconfig: node?.tsconfig,
    //         externals: node?.externals,
    //         packageJSON: node?.packageJSON,
    //         esoptions: { write: false },
    //     },
    //     (info) => {
    //         if (info.type !== "build" && info.type !== "rebuild") return;
    //         if (info.result.errors.length > 0) return void error(url.absolute, info.result.errors);
    //         const content = info.result.outputFiles?.at(0)?.text;
    //         if (content)
    //         {
    //             cache.add(url, Buffer.from(content, "utf8"), FileConstants.MimeTypes[".js"], null);
    //             update(url.absolute, "");
    //         }
    //     }
    // );
    // watchContexts.set(url.absolute, watcher);
    // }

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
