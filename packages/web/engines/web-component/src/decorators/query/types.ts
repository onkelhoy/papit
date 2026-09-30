export type Setting<T extends Element> = {
    selector: string | (() => string);
    outside?: boolean;
    load(element: T): void;
    error(): void;
}