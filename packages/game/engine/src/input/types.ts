import { MouseSettings, Mouse } from "./mouse";
import { Touches } from "./touches";

export type Settings = {
    mouse: MouseSettings;
    touch: undefined;
    keyboard: undefined;

    verbose?: boolean;
}

export type ClickEvents = {
    target: Mouse | Touches;
}
// CONSTS 