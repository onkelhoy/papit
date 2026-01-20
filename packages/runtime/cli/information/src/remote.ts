import { Terminal } from "@papit/terminal";
import { RemotePackage, RemotePackages } from "./types";

export class Remote {
    static map = new Map<string, string>();
    private static abortsignal: AbortController | undefined;
    private static emitter = new EventTarget();

    static async init(scope: string, size: number = 100, from = 0) {
        try
        {
            this.abortsignal = new AbortController();
            const res = await fetch(
                `https://registry.npmjs.org/-/v1/search?text=${scope}&size=${size}&from=${from}`,
                {
                    signal: this.abortsignal.signal
                }
            )
            if (!res.ok) throw null; // data will get undefined 

            const data = await res.json() as RemotePackages;
            this.abortsignal = undefined;
            this.emitter.dispatchEvent(new Event("change"));
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

    static get(name: string) {
        const version = this.map.get(name);
        if (version) return version;

        return new Promise<null | string>(resolve => {
            const loader = async () => {

                try
                {
                    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
                    if (!res.ok) return resolve(null);

                    const data = await res.json() as RemotePackage;
                    this.map.set(data.name, data["dist-tags"].latest);

                    resolve(data["dist-tags"].latest);
                }
                catch 
                {
                    resolve(null);
                }
            }

            if (this.abortsignal)
            {
                this.emitter.addEventListener("change", loader)
            }
            else 
            {
                loader();
            }
        })
    }
}