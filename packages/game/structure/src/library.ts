import { transformPattern } from "@papit/corner-lookup";
import type { ModuleDefinition, ModuleCandidate, LibraryOptions } from "./types";

/**
 * The modules a structure can use. A module is registered for every rotation (and mirror)
 * of its pattern, so one authored module covers all its turned versions.
 *
 * @example
 * const library = new ModuleLibrary(blockModules());
 * library.candidates(0b00110011);
 */
export class ModuleLibrary {
    readonly mirror: boolean;
    readonly modules: ModuleDefinition[] = [];
    /** true once any module has sockets; the structure then solves neighbours with wfc */
    hasSockets = false;
    private byPattern: ModuleCandidate[][] = Array.from({ length: 256 }, () => []);

    constructor(modules: ModuleDefinition[] = [], options: LibraryOptions = {}) {
        this.mirror = options.mirror ?? false;
        for (const module of modules) this.add(module);
    }

    add(module: ModuleDefinition) {
        this.modules.push(module);
        if (module.sockets && Object.keys(module.sockets).length > 0) this.hasSockets = true;
        const seen = new Set<number>();
        for (const mirror of this.mirror ? [false, true] : [false])
        {
            for (let rotation = 0; rotation < 4; rotation++)
            {
                const pattern = transformPattern(module.pattern, 8, rotation, mirror);
                if (seen.has(pattern)) continue; // symmetric module, first transform is enough
                seen.add(pattern);
                this.byPattern[pattern].push({ module, rotation, mirror });
            }
        }
        return this;
    }

    /** Every module and transform that fills `pattern`. Empty when nothing fits. */
    candidates(pattern: number): readonly ModuleCandidate[] {
        return this.byPattern[pattern & 255];
    }

    /** Patterns with no module, useful to check a library is complete. */
    missing() {
        const out: number[] = [];
        for (let p = 1; p < 256; p++)
        {
            if (this.byPattern[p].length === 0) out.push(p);
        }
        return out;
    }
}
