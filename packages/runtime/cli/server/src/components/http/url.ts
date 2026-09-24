import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { IncomingMessage } from "node:http";

import { Information, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";

import { ForbiddenError, InternalServerError } from "components/errors";

/** True when `location` is the workspace root or inside it; the server never serves beyond it. */
export function isInsideRoot(location: string) {
    const relative = path.relative(Information.root.location, path.resolve(location));
    return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

/**
 * Resolves a request to a file or folder: an absolute path inside the workspace, else the path
 * under the current folder, the package, then the workspace root.
 * @throws ForbiddenError (403) when the path resolves outside the workspace root
 */
export function getURL(
    request: IncomingMessage,
) {
    // Convert URL path back to native fs path on Windows before any joins
    if (process.platform === 'win32' && request.url && /^\/[A-Za-z]:/.test(request.url))
    {
        request.url = request.url.slice(1).replace(/\//g, '\\');
    }

    const get = () => {

        if (request.url && isInsideRoot(request.url) && fs.existsSync(request.url) && fs.statSync(request.url).isFile()) 
        {
            return { absolute: request.url, relative: path.relative(request.url, Information.package.location) }; // this might bite later
        }

        const rest = [Arguments.string("folder"), request.url].filter(v => v !== undefined);
        const potentials = [Information.local, Information.package.location, Information.root.location];

        for (const potential of potentials)
        {
            const absolute = path.join(potential, ...rest);
            if (!isInsideRoot(absolute)) continue;
            if (fs.existsSync(absolute))
            {
                return { absolute, relative: path.relative(potential, absolute) || path.relative(Information.package.location, Information.local) || path.sep };
            }
        }

        const absolute = path.join(Information.package.location, request.url ?? path.sep);
        if (!isInsideRoot(absolute)) throw new ForbiddenError(`"${request.url}" is outside the served root`);

        return { absolute, relative: request.url ?? path.sep };
    }

    const data = get();
    if (data.absolute.endsWith(path.sep)) data.absolute = data.absolute.slice(0, data.absolute.length - 1);

    return {
        absolute: path.normalize(data.absolute),
        relative: path.normalize(data.relative),
    };
}

export function getPackageLocationFromImportMeta(location: string) {
    const __filename = fileURLToPath(location);
    let __dirname = __filename;

    // get the parent folder of 'lib' if it ends with 'lib'
    for (let i = 0; i < 5; i++)
    {
        __dirname = path.dirname(__dirname);
        if (!fs.existsSync(path.join(__dirname, "package.json"))) continue;

        return __dirname;
    }

    return null;
}

function getNearestPackageLocation(location: string) {
    let target = location;
    while (target !== "/" && !fs.existsSync(path.join(target, "package.json"))) 
    {
        target = path.dirname(target);
    }

    return target;
}

export function getPACKAGE(url: ReturnType<typeof getURL>) {
    const location = getNearestPackageLocation(url.absolute);
    if (!location)
    {
        throw new InternalServerError(`could not find package at 1: ${location}`);
    }

    const node = PackageGraph.search(location)
    if (!node)
    {
        throw new InternalServerError(`could not find package at 2: ${location}`);
    }

    return node;
}