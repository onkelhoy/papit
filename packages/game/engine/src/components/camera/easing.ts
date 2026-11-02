/** A fraction per 60 Hz frame, or a function from `dt` to the fraction to move this frame. */
export type Easing = number | ((dt: number) => number);

/** How far to move this frame. A number moves the same distance per second at any frame rate. */
export function easeFactor(ease: Easing, dt: number) {
    return typeof ease === "function" ? ease(dt) : 1 - (1 - ease) ** (dt * 60);
}
