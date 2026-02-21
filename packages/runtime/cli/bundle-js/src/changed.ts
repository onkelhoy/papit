import fs from "node:fs";
import path from "node:path";

export function hasChanged(location: string, filenames: string[], options: Partial<{ tempSuffix: string, filter: RegExp | ((fileName: string) => boolean) }> = { }) {
    
    if (!options.filter) options.filter = /\.(css|((j|t)s(\w|on)?))$/i;

    const savedLocation = path.join(location, `.temp/mstime.${options.tempSuffix ?? "papit-bundle-js"}.json`);
    filenames = filenames.concat(path.join(location, "package.json"), path.join(location, "tsconfig.json"));

    let data: Record<string, number> = {};
    const checked: Record<string, number> = {};
    try 
    {
        if (!fs.existsSync(savedLocation)) return true;

        const content = fs.readFileSync(savedLocation, { encoding: "utf-8" });
        data = JSON.parse(content.trim() === "" ? "{}" : content);

        for (const filename of filenames)
        {
            if (options.filter instanceof RegExp && !options.filter.test(filename)) continue; 
            if (typeof options.filter === "function" && !options.filter?.(filename)) continue;

            if (!data[filename]) return true;

            try 
            {
                const value = fs.statSync(filename)?.mtimeMs;
                if (data[filename] !== value) 
                {
                    checked[filename] = value;
                    return true;
                }
            } catch { }
        }

        return false;
    }
    finally 
    {
        data = {};
        for (const filename of filenames)
        {
            if (options.filter instanceof RegExp && !options.filter.test(filename)) continue; 
            if (typeof options.filter === "function" && !options.filter?.(filename)) continue;

            if (checked[filename]) data[filename] = checked[filename];
            else 
            {
                try {
                    const stat = fs.statSync(filename);
                    if (!stat) continue;
                    data[filename] = stat.mtimeMs;
                } catch {}
            }
        }
        const dirname = path.dirname(savedLocation);
        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
        fs.writeFileSync(savedLocation, JSON.stringify(data));
    }
}