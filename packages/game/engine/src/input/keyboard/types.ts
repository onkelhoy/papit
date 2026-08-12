export type KeyInfo = {
    clicked: boolean;
    start: null | number;
    stop: null | number;
}

export type KeyboardEventMap = {
    [key: string]: CustomEvent<KeyInfo>;
}
export type KeyboardEventListener = (event: CustomEvent<KeyInfo>) => void;