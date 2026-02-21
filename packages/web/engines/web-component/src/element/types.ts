export type Setting = {
    requestUpdateTimeout: number;
    lightDOM: boolean;
}

export type QueryMeta = {
    propertyKey: PropertyKey;
    selector: string;
    load?(element: unknown): void;
}

export type PropertyMeta = Map<string, (newValue: string | null | undefined, oldValue: string | null | undefined) => void>;