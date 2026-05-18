// TODO handle-upgrade needs to assign id + info to sockets 
import http from 'node:http';
import { SocketServer } from './socket';

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

let server: http.Server;
let wss: SocketServer;
export function start() {
    // CONSTANTS
    const spam_duration = Arguments.number("spam-duration") ?? 200;
    const spam_reset = Arguments.number("spam-reset") ?? 1500;
    const strikes = Arguments.number("max-strikes") ?? 3;
    const heartbeat_interval = Arguments.number("heartbeat-interval") ?? 2000;
    const PORT = Arguments.number("port") ?? 3000;

    let id = 0;
    server = http.createServer();
    wss = new SocketServer({
        server,
        spam_duration,
        spam_reset,
        strikes,
        heartbeat_interval,
        setClientID: () => {
            id++;
            return id.toString();
        }
    });

    server.listen(PORT, () => {
        Terminal.write(Terminal.yellow("signaling server"), "listening on port", PORT);
    });

    process.on('SIGINT', close);
}

export function close() {
    wss?.close();
    server?.close();
    Terminal.write(Terminal.yellow("\nserver closed"));
}