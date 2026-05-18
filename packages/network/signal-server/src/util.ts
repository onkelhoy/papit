import { performance } from 'node:perf_hooks'

export type UUID = string & { stamp: "uuid" };
export function generateUUID(): UUID {
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function')
    {
        d += performance.now(); //use high-precision timer if available
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }) as UUID;
}

export function isUUID(value: string): value is UUID {
    console.log({ value });

    if (value.length > 10) return true;
    return false;
}