import type { PushOptions, PushStatus, PushSubscription, VapidKeys } from "../types";
import { encryptPush } from "./encrypt";
import { vapidAuthorization } from "./vapid";

const DEFAULT_TTL = 60;
const DEFAULT_TIMEOUT = 10_000;

/**
 * Sends `payload` to one browser through its push service. Never throws.
 * `gone` means the subscription is dead for good, so whoever holds it should drop it.
 */
export async function sendPush(
    subscription: PushSubscription,
    payload: string | Uint8Array,
    keys: VapidKeys,
    subject: string,
    options: PushOptions = {},
): Promise<PushStatus> {
    try
    {
        const response = await fetch(subscription.endpoint, {
            method: "POST",
            // a redirect could point anywhere, push services don't use them
            redirect: "manual",
            signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT),
            headers: {
                "Authorization": vapidAuthorization(subscription.endpoint, keys, subject),
                "Content-Encoding": "aes128gcm",
                "Content-Type": "application/octet-stream",
                "TTL": String(options.ttl ?? DEFAULT_TTL),
                "Urgency": options.urgency ?? "high",
            },
            body: encryptPush(payload, subscription),
        });

        if (response.status === 404 || response.status === 410) return "gone";
        return response.ok ? "sent" : "failed";
    }
    catch
    {
        return "failed";
    }
}
