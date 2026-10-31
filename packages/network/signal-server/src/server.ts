import http, { OutgoingHttpHeaders } from "node:http";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { MAX_MESSAGE_BYTES } from "@papit/peer-message";

import { createPushRoutes } from "./push/routes";
import { generateVapidKeys, validateVapidKeys } from "./push/vapid";
import { SocketServer } from "./socket";
import type { PushConfig } from "./types";

const DEFAULT_SUBJECT = "https://github.com/onkelhoy/papit";

const baseHeaders: OutgoingHttpHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": 2592000, // 30 days
    "Content-Type": "application/json",
};

let server: http.Server | undefined;
let wss: SocketServer | undefined;
let pushRoutes: ReturnType<typeof createPushRoutes> | undefined;

/** `--allow-origin` narrows CORS to a comma separated list. */
function corsHeaders(request: http.IncomingMessage): OutgoingHttpHeaders {
    const allowed = Arguments.string("allow-origin")?.split(",");
    if (!allowed) return baseHeaders;

    const origin = request.headers.origin ?? "";
    return { ...baseHeaders, "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0], "Vary": "Origin" };
}

/** Push config from flags and env. Undefined with `--no-push`. Throws on bad config, so it can't start half working. */
function pushConfig(): PushConfig | undefined {
    if (Arguments.has("no-push")) return undefined;

    const subject = Arguments.string("vapid-subject") ?? process.env.VAPID_SUBJECT ?? DEFAULT_SUBJECT;
    if (!/^(mailto:|https:)/.test(subject)) throw new Error("the VAPID subject must be a mailto: or https: address");

    const options = {
        allowPrivate: Arguments.has("allow-private"),
        rate: Arguments.number("push-rate"),
        // a bare --trust-proxy means one proxy
        trustProxy: Arguments.has("trust-proxy") ? Arguments.number("trust-proxy") ?? 1 : 0,
    };

    const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = process.env;
    if (publicKey && privateKey)
    {
        validateVapidKeys({ publicKey, privateKey });
        return { keys: { publicKey, privateKey }, subject, persistent: true, ...options };
    }
    if (publicKey || privateKey) throw new Error("set both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");

    Terminal.write(Terminal.yellow("push"), "no VAPID keys set, using throwaway keys: push tokens stop working on restart");
    return { keys: generateVapidKeys(), subject, persistent: false, ...options };
}

/**
 * Starts an HTTP + WebSocket signalling server configured from CLI flags (see README).
 * Besides the socket it serves `GET /networks` (the public network list as JSON), `GET /health`
 * and, unless `--no-push`, the push routes.
 * The port is `--port`, else `process.env.PORT`, else 3000.
 */
export function start() {
    if (server) return server;

    const push = pushConfig();
    pushRoutes = push && createPushRoutes(push);
    const env = Number.parseInt(process.env.PORT ?? "", 10);
    const PORT = Arguments.number("port") ?? (Number.isInteger(env) && env >= 0 ? env : 3000);
    const httpserver = server = http.createServer();
    const socketserver = wss = new SocketServer({
        server: httpserver,
        spam_duration: Arguments.number("spam-duration") ?? 200,
        spam_reset: Arguments.number("spam-reset") ?? 1500,
        strikes: Arguments.number("max-strikes") ?? 3,
        heartbeat_interval: Arguments.number("heartbeat-interval") ?? 2000,
        forward_rate: Arguments.number("forward-rate") ?? 200,
        maxPayload: Arguments.number("max-payload") ?? MAX_MESSAGE_BYTES,
    });

    httpserver.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
        const headers = corsHeaders(req);
        if (req.method === "OPTIONS")
        {
            res.writeHead(204, headers);
            res.end();
            return;
        }

        const { pathname } = new URL(req.url ?? "/", "http://localhost");
        if (req.method === "GET" && pathname === "/health")
        {
            res.writeHead(200, headers);
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        if (req.method === "GET" && pathname === "/networks")
        {
            res.writeHead(200, headers);
            res.end(JSON.stringify(socketserver.list()));
            return;
        }

        if (pushRoutes?.handle(req, res, pathname, headers)) return;

        res.writeHead(405, headers);
        res.end(JSON.stringify({ error: `${req.method} ${pathname} is not allowed` }));
    });

    httpserver.listen(PORT, () => {
        const address = httpserver.address();
        Terminal.write(Terminal.yellow("signaling server"), "listening on port", typeof address === "object" && address ? address.port : PORT);
    });

    process.on("SIGINT", close);
    return httpserver;
}

/** Stops the server started by `start()`. Safe to call more than once. */
export function close() {
    if (!server) return;

    process.off("SIGINT", close);
    wss?.close();
    pushRoutes?.close();
    server.closeAllConnections?.();
    server.close();
    server = wss = pushRoutes = undefined;
    Terminal.write(Terminal.yellow("\nserver closed"));
}
