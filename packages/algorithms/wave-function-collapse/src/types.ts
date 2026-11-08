import type { Random } from "@papit/random";

/** A link from a slot to a neighbour, with a side id the rule can use (e.g. edge index). */
export type Link = { slot: number; side: number };

/** Everything the solver needs to know, as plain callbacks. Options are indices 0..count-1. */
export type Problem = {
    slotCount: number;
    /** number of options for a slot */
    options(slot: number): number;
    /** relative chance of an option, default 1 */
    weight?(slot: number, option: number): number;
    /** neighbours of a slot */
    links(slot: number): readonly Link[];
    /** can `option` at `slot` sit beside `other` at `link.slot`, across `link.side` */
    compatible(slot: number, option: number, link: Link, other: number): boolean;
};

export type SolveOptions = {
    random: Random;
    /** slots to solve; the rest keep their `fixed` option. Default: all */
    region?: Iterable<number>;
    /** option per slot for slots outside the region, -1 for none */
    fixed?: ArrayLike<number>;
};

export type Solution = {
    /** chosen option per slot, -1 for slots with no options */
    assignment: Int32Array;
    /** slots where constraints could not be met; they got a weighted pick ignoring neighbours */
    conflicts: number[];
};
