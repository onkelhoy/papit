import { PackageGraph } from "./graph";
import { Information } from "./information";
import { RemotePackage, RemotePackages } from "./types";

export class Remote {
    static map = new Map<string, string>();
    private static abortsignal: AbortController | undefined;
    private static emitter = new EventTarget();

    private static hasinit = false;
    static async init(scope: string, size: number = 100, from = 0) {
        if (this.abortsignal) return;

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
        finally 
        {
            this.hasinit = true;
        }
    }

    static async get(name: string) {
        if (!this.hasinit) await Remote.init(Information.scope, PackageGraph.size);

        const version = this.map.get(name);
        if (version) return version;

        return new Promise<null | string>(resolve => {
            const loader = async () => {

                try
                {
                    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
                    if (!res.ok) throw null;

                    const data = await res.json() as RemotePackage;
                    this.map.set(data.name, data["dist-tags"].latest);

                    resolve(data["dist-tags"].latest);
                }
                catch 
                {
                    resolve(null);
                }
                finally 
                {
                    this.emitter.removeEventListener("change", loader)
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