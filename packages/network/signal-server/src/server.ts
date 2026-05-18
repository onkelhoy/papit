// TODO handle-upgrade needs to assign id + info to sockets 
import http, { OutgoingHttpHeaders } from 'node:http';
import { createSocketServer, wss } from './socket';

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

let server: http.Server;
// let wss: SocketServer;

const headers: OutgoingHttpHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET',
    'Access-Control-Max-Age': 2592000, // 30 days
    /** add other headers as per requirement */
    'Content-Type': 'application/json',
};

export function start() {
    // CONSTANTS
    console.log('running start')
    const spam_duration = Arguments.number("spam-duration") ?? 200;
    const spam_reset = Arguments.number("spam-reset") ?? 1500;
    const strikes = Arguments.number("max-strikes") ?? 3;
    const heartbeat_interval = Arguments.number("heartbeat-interval") ?? 2000;
    const PORT = Arguments.number("port") ?? 8080;

    let id = 0;
    server = http.createServer();
    createSocketServer({
        server,
    });
    // wss = new SocketServer({
    //     server,
    //     spam_duration,
    //     spam_reset,
    //     strikes,
    //     heartbeat_interval,
    //     setClientID: () => {
    //         id++;
    //         return id.toString();
    //     }
    // });

    server.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {


        if (req.method === 'OPTIONS')
        {
            res.writeHead(204, headers);
            res.end();
            return;
        }

        if (req.method === 'GET')
        {
            // router(req, res, headers, wss);
            res.writeHead(200, headers);
            res.write("hello world");
            res.end()
            return;
        }

        res.writeHead(405, headers);
        res.end(`${req.method} is not allowed for the request.`);
    });

    server.listen(PORT, () => {
        Terminal.write(Terminal.yellow("signaling server"), "listening on port", PORT);
    });

    process.on('SIGINT', close);
}

export function close() {
    // wss?.close();
    server?.close();
    Terminal.write(Terminal.yellow("\nserver closed"));
}