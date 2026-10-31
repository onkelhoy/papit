import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import type { PushSubscription } from "../types";
import { encryptPush } from "./encrypt";

const MAX_ENDPOINT_LENGTH = 2048;

// addresses the server must never be made to call: its own machine and whatever network it sits in
const privateAddresses = new BlockList();
for (const [address, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
] as const)
{
    privateAddresses.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
    ["::", 128],
    ["::1", 128],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
] as const)
{
    privateAddresses.addSubnet(address, prefix, "ipv6");
}

/** Resolves a hostname to its addresses. */
export type HostLookup = (hostname: string) => Promise<{ address: string }[]>;

const resolve: HostLookup = (hostname) => lookup(hostname, { all: true });

/**
 * Checks untrusted input against the shape of a subscription, and returns only the fields a push needs.
 * The endpoint must be https on a named host, the keys must be usable. Null when anything is off.
 * `allowPrivate` is for instances inside a private network: http, IP addresses and local names pass too.
 */
export function parseSubscription(value: unknown, allowPrivate = false): PushSubscription | null {
    const { endpoint, keys } = (value ?? {}) as Partial<PushSubscription>;
    if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return null;
    if (typeof keys?.p256dh !== "string" || typeof keys.auth !== "string") return null;

    const subscription = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
    try
    {
        const { protocol, hostname, username, password } = new URL(endpoint);
        if (username || password) return null;
        if (allowPrivate)
        {
            if (protocol !== "https:" && protocol !== "http:") return null;
        }
        else if (protocol !== "https:" || isIP(hostname.replace(/[[\]]/g, "")) || !hostname.includes(".")) return null;

        // the real thing is the best check of the keys, it refuses a point that isn't on the curve too
        encryptPush("", subscription);
        return subscription;
    }
    catch
    {
        return null;
    }
}

/**
 * True when every address behind `endpoint` is public. Ask again before each push: a token never
 * changes but what its hostname resolves to can. False when the host doesn't resolve.
 */
export async function isPublicEndpoint(endpoint: string, lookupHost: HostLookup = resolve): Promise<boolean> {
    try
    {
        const addresses = await lookupHost(new URL(endpoint).hostname);
        return addresses.length > 0 && addresses.every(({ address }) => {
            return !privateAddresses.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
        });
    }
    catch
    {
        return false;
    }
}
