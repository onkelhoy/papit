import type { GameOptions } from "../types";
import { cleanCode } from "./code";

/** The last game of this tab. */
export type Remembered = {
    code: string;
    role: "host" | "guest";
    /** Proves to the host it's me again after a reload. */
    token: string;
    time: number;
    /** A host's options, to open the same game again. */
    options?: GameOptions;
};


/**
 * Remembers the game a tab is in, so a reload goes back to it: the host opens the same code again, a
 * guest rejoins with the same token and gets its place back. `sessionStorage` by default: per tab.
 */
export class Memory {
    private key: string;

    /** `maxAge`: ms since the game was last seen, after that it's forgotten. */
    constructor(private storage: Storage | null, app: string, private maxAge = 5 * 60_000) {
        this.key = `${app}.game`;
    }

    get(): Remembered | null {
        try
        {
            const saved = JSON.parse(this.storage?.getItem(this.key) ?? "null") as Remembered | null;
            if (!saved || !cleanCode(saved.code) || typeof saved.token !== "string" || Date.now() - saved.time > this.maxAge) return null;
            return saved;
        }
        catch
        {
            return null;
        }
    }

    /** Same code and role keep their token, anything else gets a new one. */
    save(code: string, role: Remembered["role"], options?: GameOptions): Remembered {
        const old = this.get();
        const same = old && old.code === code && old.role === role;
        const saved: Remembered = {
            code,
            role,
            token: same ? old.token : crypto.randomUUID(),
            time: Date.now(),
            options: options ?? (same ? old.options : undefined),
        };
        try { this.storage?.setItem(this.key, JSON.stringify(saved)); }
        catch { /* private mode or full: the game works, a reload just doesn't come back */ }
        return saved;
    }

    /** Still in it: seen now. */
    touch() {
        const saved = this.get();
        if (saved) this.save(saved.code, saved.role, saved.options);
    }

    clear() {
        try { this.storage?.removeItem(this.key); }
        catch { /* nothing to forget */ }
    }
}
