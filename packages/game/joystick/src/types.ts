export type JoystickMode = "follow" | "floating" | "fixed";

/** A control's position inside the joystick area, in percent of its width and height. */
export type LayoutPosition = { x: number; y: number };

/** Positions of the stick and every button, keyed by `stick` or the button's `name`/index. */
export type Layout = Record<string, LayoutPosition>;
