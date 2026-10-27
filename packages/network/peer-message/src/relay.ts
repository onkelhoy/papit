import { BROADCAST } from "./constants";
import type { Meta, PeerId, RelayAction } from "./types";

/**
 * Decides what node `me` does with a message it received, and records the hop on `meta`.
 * Call it once per received message, before delivering or forwarding.
 *
 * - `me` already in `hops` → `"drop"` (loop)
 * - `receiver` is `me` → `"deliver"`
 * - otherwise one `ttl` is spent: a broadcast is `"both"` while `ttl` remains, else `"deliver"`;
 *   anything else is `"forward"` while `ttl` remains, else `"drop"`
 */
export function relay(meta: Meta, me: PeerId): RelayAction {
    if (meta.hops.includes(me)) return "drop";
    meta.hops.push(me);

    if (meta.receiver === me) return "deliver";

    meta.ttl = Math.max(0, meta.ttl - 1);
    if (meta.receiver === BROADCAST) return meta.ttl > 0 ? "both" : "deliver";

    return meta.ttl > 0 ? "forward" : "drop";
}
