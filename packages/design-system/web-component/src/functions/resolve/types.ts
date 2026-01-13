export type Resolvable<T> = Promise<T> | T | (() => (T | Promise<T>));
