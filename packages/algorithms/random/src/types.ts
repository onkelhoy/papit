/** A seed: an unsigned 32 bit integer is used as is, anything else is hashed. */
export type Seed = number | string;

/** The four sfc32 state words. */
export type RandomState = [number, number, number, number];
