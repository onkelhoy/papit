import path, { relative } from "node:path";
import fs from "node:fs";
import { IncomingMessage } from "node:http";
import { Arguments, getJSON, getPathInfo, LocalPackage } from "@papit/util";
import { InternalServerError } from "../errors";

export function getURL(
  request: IncomingMessage,
  info: ReturnType<typeof getPathInfo>,
) {
  if (request.url && fs.existsSync(request.url) && fs.statSync(request.url).isFile()) return { absolute: request.url, relative: path.relative(request.url, info.package) }; // this might bite later

  const rest = [Arguments.string("folder"), request.url].filter(v => v !== undefined);

  const potentials = [info.local, info.package, info.root];
  for (const potential of potentials)
  {
    const absolute = path.join(potential, ...rest);
    if (fs.existsSync(absolute)) return { absolute, relative: path.relative(potential, absolute) || path.relative(info.local, info.root) || "/" };
  }

  return { absolute: info.package, relative: request.url ?? "/" };
}

export function getPACKAGE(url: ReturnType<typeof getURL>) {
  const info = getPathInfo(url.absolute);
  const packageJSON = getJSON<LocalPackage>(path.join(info.package, "package.json"));
  if (!packageJSON)
  {
    throw new InternalServerError(`could not find package.json at: ${url.absolute}`);
  }

  return { info, packageJSON }
}