import * as ws from 'ws';
import http from 'node:http';
import { generateUUID, UUID } from './util';
import { MetaJson } from '@papit/meta-json';
import { Meta, SignalType } from 'shared';

type Options = ws.ServerOptions & Partial<{
    maxstrikes: number;
    spam_reset: number;
    spam_duration: number;
}>;
type Socket = ws.WebSocket & {
    uuid: UUID;
    is_alive: boolean;
    lastmessage: number;
    strike: number;
    network?: UUID;
}

let wss: ws.Server<typeof ws.WebSocket, typeof http.IncomingMessage> & Partial<{ sockets: Map<UUID, Socket> }> | null = null;
let options: Options | null = null;

function create(_options: Options, callback?: () => void) {
    options = options;
    wss = new ws.WebSocketServer(_options, callback);
    wss.sockets = new Map();

    wss.on("connection", (socket: Socket, _request) => {
        socket.on("open", handleOpen.bind(socket));
        socket.on("message", handleMessage.bind(socket));
        socket.on("error", handleError.bind(socket));
        socket.on("close", handleClose.bind(socket));
        socket.on("ping", handlePing.bind(socket));
        socket.on("pong", handlePong.bind(socket));
    });

    wss.on("close", () => {
        console.log('singal server is closed');
    });

    wss.on("error", (error) => {
        console.log("signal server error", error);
    });

    return wss;
}

function printerror(error: string) {
    console.log(
        "[socket server] server error",
        performance.now(),
        error,
    );
}
function spamcheck(socket: Socket): boolean {
    const maxstrikes = (options?.maxstrikes || 5);

    if (socket.lastmessage)
    {
        const duration = performance.now() - socket.lastmessage;
        if (duration < (options?.spam_duration || 200))
        {
            // user sent message before duration time has passed, user should have MAXSTRIKES strikes and then banned
            socket.strike++;
        }
        else if (socket.strike < maxstrikes && duration >= (options?.spam_reset || 1500))
        {
            socket.strike = 0;
        }
    }

    socket.lastmessage = performance.now();
    const spamming = socket.strike >= maxstrikes;

    if (!spamming) return false;

    printerror(`socket ${socket.uuid} is spamming server`);
    socket.close();
    return true;
}

export {
    wss,
    create as createSocketServer,
}

// event handlers 
function handleOpen(this: Socket) {
    this.uuid = generateUUID();
    this.strike = 0;
    this.lastmessage = Number.MIN_SAFE_INTEGER;
    wss?.sockets?.set(this.uuid, this);
}
function handleClose(this: Socket, code: number, reason: Buffer) {
    if (!this.uuid) return;
    wss?.sockets?.delete(this.uuid);
}
function handleError(this: Socket, error: Error) {
    console.log("error", this, error)
}
function handlePing(this: Socket, data: Buffer) {
    if (spamcheck(this)) return;
    this.send("pong");
}
function handlePong(this: Socket, data: Buffer) {
    this.is_alive = true;
}
function handleMessage(this: Socket, stream: ws.RawData, isBinary: boolean) {
    if (spamcheck(this)) return;

    if (!isBinary)
    {
        // only accept binary frames
        this.close();
        return;
    }

    const data = Array.isArray(stream)
        ? Buffer.concat(stream)   // fragmented frame — rare but handle it
        : stream as Buffer;       // Buffer extends Uint8Array, passes straight through

    const msg = MetaJson.FromBinary<Meta<SignalType>>(data, false);

    console.log(msg.meta.type, msg.meta.sender, '→', msg.meta.receiver);
}