import fs from "node:fs";

import { jsBundle } from "@papit/bundle-js";
import { Arguments } from "@papit/arguments";

import { getPACKAGE, getURL } from "components/http/url";
import { NotFoundError } from "components/errors";

import { Cache } from "./cache";
import { FileConstants } from "./types";

export async function bundler(url: ReturnType<typeof getURL>, cache: Cache) {
    const node = getPACKAGE(url);

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
