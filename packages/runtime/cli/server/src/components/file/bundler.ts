import fs from "node:fs";
import { jsBundler } from "@papit/build";
import { BuildResult, BuildContext } from "esbuild";

import { getPACKAGE, getURL } from "../http/url";
import { error, update } from "../http/socket";
import { InternalServerError, NotFoundError } from "../errors";
import { Cache } from "./cache";
import { FileConstants } from "./types";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

export async function bundler(
    url: ReturnType<typeof getURL>,
    cache: Cache
) {
    const node = getPACKAGE(url);

    const bundle = await jsBundler(
        url.absolute,
        undefined,
        node,
        Arguments.instance,
        false,
        (counter, result) => {
            if (counter === 1) return; // in live mode we called the build once before 

            if (result.errors.length > 0)
            {
                return void error(url.absolute, result.errors);
            }
            const content = result.outputFiles?.at(0)?.text;
            if (content)
            {
                cache.add(
                    url,
                    Buffer.from(content, "utf8"),
                    FileConstants.MimeTypes[".js"],
                    null,
                );

                return void update("/" + url.relative, "");
            }
        }
    );

    let result: BuildResult;
    if (Arguments.has("live"))
    {
        // we should store the context so we can dispose of it?
        const context = bundle as BuildContext;
        result = await context.rebuild(); // we call the rebuild so we can return on this call 
        // should we do something with it?
    }
    else 
    {
        result = bundle as BuildResult;
    }

    if (result.errors.length > 0)
    {
        if (Arguments.error) Terminal.error("something went wrong to bundle file", result.errors);
        throw new InternalServerError("something went wrong to bundle file: " + url.relative);
    }

    const content = result.outputFiles?.at(0)?.text;
    if (content) 
    {
        cache.add(
            url,
            Buffer.from(content, "utf8"),
            FileConstants.MimeTypes[".js"],
            fs.statSync(url.absolute)?.mtimeMs ?? null,
        );

        return content;
    }

    throw new NotFoundError("file not found: " + url.relative);
}