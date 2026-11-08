import type { Curve, Shape } from "./types";

const HALF_PI = Math.PI / 2;
const SAMPLES = 64;

type FadeState = {
    from: number;
    to: number;
    start: number;
    duration: number;
    shape: Shape;
};

const shapes: Record<string, Shape> = {
    "linear": t => t,
    "ease-in": t => t * t,
    "ease-out": t => 1 - (1 - t) * (1 - t),
    "ease-in-out": t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t),
};

// running fades, so a new fade can start from the exact current value
const states = new WeakMap<AudioParam, FadeState>();

/** Turns a curve into a shape for a fade going `up` or down. */
export function toShape(curve: Curve, up: boolean): Shape {
    if (typeof curve === "function") return curve;
    if (typeof curve !== "string") return sampled(curve);
    if (curve === "equal-power")
    {
        // sine in, cosine out: two crossing fades keep the summed power constant
        return up ? t => Math.sin(t * HALF_PI) : t => 1 - Math.cos(t * HALF_PI);
    }
    return shapes[curve] ?? shapes.linear;
}

function sampled(values: readonly number[]): Shape {
    if (values.length === 0) return shapes.linear;
    if (values.length === 1) return () => values[0];
    const last = values.length - 1;
    return t => {
        const at = t * last;
        const index = Math.min(Math.floor(at), last - 1);
        const rest = at - index;
        return values[index] + (values[index + 1] - values[index]) * rest;
    };
}

/** Value of a param at context time `time`, including running fades. */
export function valueAt(param: AudioParam, time: number): number {
    const state = states.get(param);
    if (!state) return param.value;
    if (state.duration <= 0 || time >= state.start + state.duration) return state.to;
    if (time <= state.start) return state.from;
    return state.from + (state.to - state.from) * state.shape((time - state.start) / state.duration);
}

/** Target value of a param: where its fade ends. */
export function targetOf(param: AudioParam): number {
    return states.get(param)?.to ?? param.value;
}

/**
 * Fades a param from its current value to `to`, scheduled on the audio thread.
 * Interrupting a running fade continues smoothly from where it is.
 */
export function fade(param: AudioParam, context: BaseAudioContext, to: number, seconds = 1, curve: Curve = "linear"): void {
    const now = context.currentTime;
    const from = valueAt(param, now);
    const shape = toShape(curve, to >= from);

    param.cancelScheduledValues(0);
    states.set(param, { from, to, start: now, duration: Math.max(0, seconds), shape });

    if (seconds <= 0 || from === to)
    {
        param.setValueAtTime(to, now);
        return;
    }

    const values = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++)
    {
        values[i] = from + (to - from) * shape(i / (SAMPLES - 1));
    }
    values[SAMPLES - 1] = to;
    param.setValueCurveAtTime(values, now, seconds);
}

/** Sets a param right away, cancelling any fade. */
export function set(param: AudioParam, context: BaseAudioContext, value: number): void {
    fade(param, context, value, 0);
}
