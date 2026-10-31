import type http from "node:http";
import { performance } from "node:perf_hooks";

const WINDOW = 60_000;

type Bucket = { tokens: number; refilled_at: number };

/** Token bucket per key: holds up to `rate` tokens, refilled at `rate` per minute. A rate of 0 means no limit. */
export class RateLimiter {
    private buckets = new Map<string, Bucket>();
    private sweeper: NodeJS.Timeout;

    constructor(private rate: number) {
        this.sweeper = setInterval(() => this.sweep(), WINDOW);
        this.sweeper.unref();
    }

    /** Spends a token for `key`, false when it has none left. */
    public allow(key: string, now = performance.now()): boolean {
        if (!this.rate) return true;

        const bucket = this.buckets.get(key) ?? { tokens: this.rate, refilled_at: now };
        bucket.tokens = Math.min(this.rate, bucket.tokens + (now - bucket.refilled_at) * this.rate / WINDOW);
        bucket.refilled_at = now;
        this.buckets.set(key, bucket);

        if (bucket.tokens < 1) return false;
        bucket.tokens--;
        return true;
    }

    /** Forgets keys idle long enough to be full again, which is the same as being unknown. */
    public sweep(now = performance.now()) {
        for (const [key, bucket] of this.buckets)
        {
            if (now - bucket.refilled_at >= WINDOW) this.buckets.delete(key);
        }
    }

    public get size() {
        return this.buckets.size;
    }

    public close() {
        clearInterval(this.sweeper);
        this.buckets.clear();
    }
}

/**
 * The address a request came from. Behind `trustProxy` proxies it is that many entries from the end of
 * `x-forwarded-for`: each proxy appends what it saw, so entries further left are whatever the client sent.
 */
export function clientAddress(request: http.IncomingMessage, trustProxy = 0): string {
    const chain = String(request.headers["x-forwarded-for"] ?? "").split(",").map(entry => entry.trim()).filter(Boolean);
    return (trustProxy > 0 ? chain[chain.length - trustProxy] : undefined) ?? request.socket.remoteAddress ?? "";
}
