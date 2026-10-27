import http, { OutgoingHttpHeaders } from "node:http";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { MAX_MESSAGE_BYTES } from "@papit/peer-message";

import { SocketServer } from "./socket";

const headers: OutgoingHttpHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, GET",
    "Access-Control-Max-Age": 2592000, // 30 days
    "Content-Type": "application/json",
};

let server: http.Server | undefined;
let wss: SocketServer | undefined;

/**
 * Starts an HTTP + WebSocket signalling server configured from CLI flags (see README).
 * Besides the socket it serves `GET /networks` (the public network list as JSON) and `GET /health`.
 * The port is `--port`, else `process.env.PORT`, else 3000.
 */
export function start() {
    if (server) return server;

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
    server.closeAllConnections?.();
    server.close();
    server = wss = undefined;
    Terminal.write(Terminal.yellow("\nserver closed"));
}
