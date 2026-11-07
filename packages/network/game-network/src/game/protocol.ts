/**
 * The messages a game sends on its own, next to the app's. App message types must not start with `PREFIX`.
 *
 * Joining:   guest → host  hello {profile, password?, token}
 *            host  → guest welcome {players, info, shared} | denied {reason}
 *            host  → rest  joined {player, previous?}
 * Leaving:   guest → host  bye                     (a drop or reload sends nothing)
 *            host  → rest  left {id, reason}
 *            host  → guest kick
 *            host  → all   closed                  (the host left for good)
 * Changes:   host  → all   info {GameInfo}
 *            host  → all   shared {owner, publish, password, kicked, known}   what a stand-in needs to host
 * Hosting:   new   → all   host {id, players}      "I host now" (the next in line), or a hand-back
 *            stand-in → owner  handover {players, info, shared}   the owner is back
 * Relaying:  guest → host  relay {to, type, data}  for a guest with no direct link to `to`
 *            host  → to    relayed {from, type, data}
 */
export const PREFIX = "game:";

export const MSG = {
    hello: "game:hello",
    welcome: "game:welcome",
    denied: "game:denied",
    joined: "game:joined",
    left: "game:left",
    bye: "game:bye",
    kick: "game:kick",
    info: "game:info",
    closed: "game:closed",
    relay: "game:relay",
    relayed: "game:relayed",
    shared: "game:shared",
    host: "game:host",
    handover: "game:handover",
} as const;

export const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
