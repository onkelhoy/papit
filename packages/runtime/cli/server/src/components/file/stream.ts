import path from "node:path";
import fs from "node:fs";

// import { getFile } from "./get";
import { FileConstants } from "./types";
import { NotFoundError } from "../errors";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

export async function streamFile(
  url: string,
  destination: NodeJS.WritableStream,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    // Stream large files
    const isBinary = FileConstants.BinaryExtensions.has(path.extname(url));
    const stream = isBinary
      ? fs.createReadStream(url, { signal })
      : fs.createReadStream(url, { signal, encoding: "utf-8" });

    stream.pipe(destination);

    stream.on("error", (err) => {
      if (Arguments.error) Terminal.error("streaming error", url);
      if (Arguments.verbose)
      {
        console.trace(err);
      }

      reject(new NotFoundError(err.message));
    });
    stream.on("close", resolve);
  });
}