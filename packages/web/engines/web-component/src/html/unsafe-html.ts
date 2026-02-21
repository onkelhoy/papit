export class UnsafeHTML {
    constructor(public readonly value: string) { }
}

export function unsafeHTML(html: string): UnsafeHTML {
    return new UnsafeHTML(html);
}