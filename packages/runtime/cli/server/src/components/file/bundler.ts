import { Arguments, Terminal } from "@papit/util";
// import { getFile } from "./get";
import { getMeta, jsBundler } from "@papit/build";
import { BuildContext } from "esbuild";
import { getPACKAGE, getURL } from "../http/url";
import { Cache } from "./cache";
import { error, update } from "../http/socket";
import { BuildResult } from "esbuild";
import { InternalServerError, NotFoundError } from "../errors";
import { FileConstants } from "./types";

export async function bundler(
    url: ReturnType<typeof getURL>,
    cache: Cache
) {
    const { info, packageJSON } = getPACKAGE(url);

    const meta = await getMeta(Arguments.has("prod") ? "prod" : "dev", info, packageJSON);
    if (Arguments.has("bundle"))
    {
        meta.externals = [];
    }

    const bundle = await jsBundler(
        url.absolute,
        undefined,
        meta,
        info,
        packageJSON,
        {
            callback(counter, result) {
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
        }
    );

    let result: BuildResult;
    if (!Arguments.has("serve"))
    {
        // we should store the context so we can dispose of it?
        const context = bundle as BuildContext;
        result = await context.rebuild();
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
            null,
        );

        return content;
    }

    throw new NotFoundError("file not found: " + url.relative);
}