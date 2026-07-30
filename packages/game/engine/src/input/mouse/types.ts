export type ButtonState = "left" | "wheel" | "right"
export type Setting = {
    pointerlock?: PointerLockOptions;
}
export type MouseEventMap = {
    move: Event;
    down: Event;
    up: Event;
}

// CONSTS 
export const MouseButtonMap: Record<1 | 2 | 3, ButtonState> = {
    1: "left",
    2: "wheel",
    3: "right",
}
export const DefaultSettings: Setting = {
    pointerlock: {
        unadjustedMovement: true, // speed on movement is same
    },
}