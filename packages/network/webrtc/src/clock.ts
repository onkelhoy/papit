import type { Clock } from "./types";

/** The browser's clock: `performance.now()` and the global timers. */
export const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
};
