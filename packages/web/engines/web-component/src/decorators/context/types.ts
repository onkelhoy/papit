export type Setting = {
    query?: string | (() => string);
    name?: string;
    attribute?: string;
    applyattribute?: boolean;
    rerender?: boolean;
    verbose?: boolean;
    update?(value: any, old: any): void;
}