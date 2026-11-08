import { Seed, RandomState } from "./types";

/**
 * Seeded pseudo random numbers (sfc32). The same seed always replays the same sequence,
 * on every machine, so procedural content and multiplayer stay in sync.
 *
 * @example
 * const rng = new Random("island-7");
 * rng.int(0, 6);            // 0..5
 * rng.fork("chunk:3,4");    // own stream, independent of how much rng was used
 */
export class Random {
    /** seed after hashing, used by `fork` */
    readonly seed: number;

    private a = 0;
    private b = 0;
    private c = 0;
    private d = 0;

    constructor(seed: Seed = 0) {
        this.seed = hash(seed);

        // splitmix32 spreads one 32 bit seed over the four state words
        let s = this.seed;
        const next = () => {
            s = (s + 0x9e3779b9) | 0;
            let z = s;
            z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
            z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
            return (z ^ (z >>> 16)) >>> 0;
        };
        this.a = next();
        this.b = next();
        this.c = next();
        this.d = next();

        // warm up, first outputs of sfc32 are weakly mixed
        for (let i = 0; i < 12; i++) this.uint();
    }

    /** Unsigned 32 bit integer. */
    uint() {
        const t = (((this.a + this.b) | 0) + this.d) | 0;
        this.d = (this.d + 1) | 0;
        this.a = this.b ^ (this.b >>> 9);
        this.b = (this.c + (this.c << 3)) | 0;
        this.c = (this.c << 21) | (this.c >>> 11);
        this.c = (this.c + t) | 0;
        return t >>> 0;
    }

    /** Float in [0, 1). */
    next() {
        return this.uint() / 4294967296;
    }

    /** Float in [min, max). */
    float(min = 0, max = 1) {
        return min + (max - min) * this.next();
    }

    /** Integer in [min, max). Returns `min` when `max <= min`. */
    int(min: number, max: number) {
        if (max <= min) return min;
        return min + Math.floor(this.next() * (max - min));
    }

    /** True with probability `p` (0..1). */
    chance(p: number) {
        return this.next() < p;
    }

    /** Random element, `undefined` for an empty array. */
    pick<T>(items: ArrayLike<T>): T | undefined {
        if (items.length === 0) return undefined;
        return items[this.int(0, items.length)];
    }

    /**
     * Index picked by weight. Negative weights count as 0.
     * Returns -1 when there are no weights or they sum to 0.
     */
    weightedIndex(weights: ArrayLike<number>) {
        let total = 0;
        for (let i = 0; i < weights.length; i++)
        {
            if (weights[i] > 0) total += weights[i];
        }
        if (total <= 0) return -1;

        let r = this.next() * total;
        let last = -1;
        for (let i = 0; i < weights.length; i++)
        {
            if (weights[i] <= 0) continue;
            last = i;
            r -= weights[i];
            if (r < 0) return i;
        }
        return last; // float rounding
    }

    /** Element picked by weight, `undefined` when nothing has weight. */
    weighted<T>(items: ArrayLike<T>, weights: ArrayLike<number>): T | undefined {
        const index = this.weightedIndex(weights);
        return index < 0 || index >= items.length ? undefined : items[index];
    }

    /** Shuffles in place (Fisher-Yates) and returns the array. */
    shuffle<T>(items: T[]): T[] {
        for (let i = items.length - 1; i > 0; i--)
        {
            const j = this.int(0, i + 1);
            const tmp = items[i];
            items[i] = items[j];
            items[j] = tmp;
        }
        return items;
    }

    /**
     * New independent stream from this seed and `key`. Does not use or change this stream,
     * so `fork("chunk:3,4")` gives the same result whatever was generated before.
     */
    fork(key: Seed) {
        return new Random(combine(this.seed, hash(key)));
    }

    /** Current position, to save or send over the network. */
    get state(): RandomState {
        return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
    }
    set state(value: RandomState) {
        this.a = value[0] | 0;
        this.b = value[1] | 0;
        this.c = value[2] | 0;
        this.d = value[3] | 0;
    }
}

/** 32 bit hash of a number or string seed. Integers pass through, other values are mixed. */
export function hash(seed: Seed): number {
    if (typeof seed === "number")
    {
        if (Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) return seed >>> 0;
        return hash(String(seed));
    }

    // FNV-1a over UTF-16 code units, then a final mix
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++)
    {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
}

function combine(a: number, b: number) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
}
