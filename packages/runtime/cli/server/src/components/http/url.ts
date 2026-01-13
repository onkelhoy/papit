import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { IncomingMessage } from "node:http";
import { InternalServerError } from "../errors";
import { Information, PackageGraph } from "@papit/information";
import { Arguments } from "@papit/arguments";

export function getURL(
  request: IncomingMessage,
) {
    const get = () => {
        if (request.url && fs.existsSync(request.url) && fs.statSync(request.url).isFile()) 
        {
            return { absolute: request.url, relative: path.relative(request.url, Information.package.location) }; // this might bite later
        }
        
        const rest = [Arguments.string("folder"), request.url].filter(v => v !== undefined);
        
        const potentials = [Information.local, Information.package.location, Information.root.location];
        for (const potential of potentials)
        {
            const absolute = path.join(potential, ...rest);
            if (fs.existsSync(absolute))
            {
                return { absolute, relative: path.relative(potential, absolute) || path.relative(Information.package.location, Information.local) || "/" };
            }
        }
        
        return { absolute: path.join(Information.package.location, request.url ?? "/"), relative: request.url ?? "/" };
    }

    const data = get();
    if (data.absolute.endsWith("/")) data.absolute = data.absolute.slice(0, data.absolute.length - 1);
    return data;
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