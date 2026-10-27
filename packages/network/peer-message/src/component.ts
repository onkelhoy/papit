import { MetaJson } from "@papit/meta-json";

import { DEFAULT_TTL, SERVER } from "./constants";
import type { Meta } from "./types";

let counter = 0;
function uuid(): string {
    const id = (globalThis as any).crypto?.randomUUID?.();
    if (typeof id === "string") return id;

    // node 18 has no global crypto. Ids only need to be unique, not secret.
    return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * A peer message: a `MetaJson` whose meta is the routing header `Meta`.
 * Payloads are JSON: an object (or a parsed payload) is `JSON.stringify`d on encode,
 * a string is taken as already encoded, binary is copied as-is.
 */
export class Message<Type extends string = string, Payload = any> extends MetaJson<Meta<Type>, Payload> {

    public toBinary(force?: boolean) {
        const payload = this.payload;
        const raw = typeof payload === "string" || payload instanceof ArrayBuffer || ArrayBuffer.isView(payload);
        if (!raw) this.payload = JSON.stringify(payload) as any;

        try
        {
            return super.toBinary(force);
        }
        finally
        {
            this.payload = payload;
        }
    }

    /**
     * Creates a message with defaults for every meta field not given:
     * a fresh `id`, `sender: ""`, `receiver: SERVER`, `timestamp: Date.now()`, `ttl: DEFAULT_TTL`
     * and `hops: [sender]` (empty without a sender).
     */
    static Create<
        This extends new (meta: any, payload: any) => MetaJson<any, any>,
        Type extends string = string,
        Payload = Object | string
    >(this: This, meta: Partial<Meta<Type>> & { type: Type }, payload: Payload): InstanceType<This>;
    // keeps the static side assignable to MetaJson.Create
    static Create<
        This extends new (meta: any, payload: any) => MetaJson<any, any>,
        M extends Object = object,
        Payload = Object | string
    >(this: This, meta: M, payload: Payload): InstanceType<This>;
    static Create(this: new (meta: any, payload: any) => MetaJson<any, any>, meta: Partial<Meta> & { type: string }, payload: unknown) {
        const sender = meta.sender ?? "";

        return new this(
            {
                id: uuid(),
                sender,
                receiver: SERVER,
                timestamp: Date.now(),
                ttl: DEFAULT_TTL,
                hops: sender ? [sender] : [],
                ...meta,
            },
            payload,
        );
    }
}
