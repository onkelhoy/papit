export type KeyInfo = {
    pressed: boolean;
    start: null | number;
    stop: null | number;
}

export type KeyboardEventMap = {
    [key: string]: CustomEvent<KeyInfo>;
}
export type KeyboardEventListener = (event: CustomEvent<KeyInfo>) => void;