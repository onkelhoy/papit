import fs from "node:fs";
import path from "node:path";

type Entry = {
    mtime: number;
}
type CacheRecord = {
    packages: Record<string, Partial<Entry>>
}
export class Cache {
    private static _cache: CacheRecord = { packages: {} };

    private static location: string;
    private static _hasloaded = false;
    static setup(rootLocation: string) { this.location = rootLocation }

    static get(name: string): Partial<Entry> | undefined {
        if (!this._hasloaded)
        {
            this._hasloaded = true;
            if (!fs.existsSync(path.join(this.location, ".temp/cache.json")))
            {
                this.save();
            }
            else 
            {
                this._cache = JSON.parse(fs.readFileSync(path.join(this.location, ".temp/cache.json"), { encoding: "utf-8" }));
            }
        }

        return this._cache.packages[name];
    }
    static set(name: string, entry: Partial<Entry>, withoutSave = false) {
        this._cache.packages[name] = {
            ...(this._cache.packages[name] ?? {}),
            ...entry
        };

        if (withoutSave) return;
        this.save();
    }

    static save() {
        if (!fs.existsSync(path.join(this.location, ".temp")))
        {
            fs.mkdirSync(path.join(this.location, ".temp"));
        }

        fs.writeFileSync(path.join(this.location, ".temp/cache.json"), JSON.stringify(this._cache));
    }
}