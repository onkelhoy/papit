export type Setting = {
    requestUpdateTimeout: number;
    throttleUpdateTimeout: number;
    lightDOM: boolean;
}

export type QueryMeta = {
    propertyKey: PropertyKey;
    selector: string | (() => string);
    outside?: boolean;
    load?(element: unknown): void;
    error?(): void;
}

export type PropertyMeta = Map<string, (newValue: string | null | undefined, oldValue: string | null | undefined) => void>;