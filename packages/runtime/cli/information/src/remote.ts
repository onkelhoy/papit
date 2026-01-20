import { Terminal } from "@papit/terminal";
import { RemotePackage, RemotePackages } from "./types";

export class Remote {
    map = new Map<string, string>();

    async init(scope: string, size: number = 100, from = 0) {
        try
        {
            const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${scope}&size=${size}&from=${from}`)
            if (!res.ok) throw null; // data will get undefined 

            const data = await res.json() as RemotePackages;
            for (const entry of data.objects)
            {
                this.map.set(entry.package.name, entry.package.version);
            }
        }
        catch 
        {
            this.map.clear();
        }
    }

    async get(name: string) {
        const version = this.map.get(name);
        if (version) return version;

        try
        {
            const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
            if (!res.ok) return null;

            const data = await res.json() as RemotePackage;
            this.map.set(data.name, data["dist-tags"].latest);

            return data["dist-tags"].latest;
        }
        catch 
        {
            return null;
        }
    }
}