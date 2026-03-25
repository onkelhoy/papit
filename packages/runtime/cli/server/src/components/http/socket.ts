import http from "node:http";
import { createHash } from "node:crypto";
import { Duplex } from "node:stream";
import path from "node:path";

import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";
import { Information, PackageNode } from "@papit/information";
import { getPACKAGE } from "./url";

const connectedClients = new Map<Duplex, PackageNode>();

export function upgrade(this: http.Server, req: http.IncomingMessage, socket: Duplex, head: Buffer) {
    // handshake
    const acceptKey = req.headers['sec-websocket-key'];
    const hash = createHash('sha1')
        .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${hash}`
    ];
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    // keeping track


    if (Arguments.info) Terminal.write(Terminal.blue("client connected"));

    // events 
    socket.on("end", () => connectedClients.delete(socket));
    socket.on("close", () => connectedClients.delete(socket));
    socket.on("error", (err: any) => {
        if (err.code === "ECONNRESET") connectedClients.delete(socket);
    });
    socket.on("data", (chunk: Buffer) => {
        try
        {
            const frame = parseWebSocketFrame(chunk);

            switch (frame.opcode)
            {
                case 0x1: // text frame
                    const message = frame.payload.toString('utf8');
                    // Parse as JSON if that's what you're sending
                    try
                    {
                        const data = JSON.parse(message);

                        switch (data.type)
                        {
                            case "register": {
                                let packageNode = getPACKAGE({ relative: data.location, absolute: path.join(Information.root.location, data.location) });
                                if (packageNode.name === Information.root.name)
                                {
                                    packageNode = Information.package;
                                }
                                connectedClients.set(socket, packageNode);
                                break;
                            }
                        }

                    }
                    catch (e) { }
                    break;

                case 0x8: // close frame
                    socket.end();
                    break;

                case 0x9: // ping
                    // Send pong back
                    const pongFrame = frameWebSocketMessage({ type: 'pong' });
                    socket.write(pongFrame);
                    break;

                default:
                    console.log('Unknown opcode:', frame.opcode);
            }
        } catch (err)
        {
            console.error('Error parsing WebSocket frame:', err);
        }
    });
}

// exposed functions 
export function update(node: PackageNode) {
    // notify all clients 
    try
    {
        if (connectedClients.size === 0)
        {
            if (Arguments.verbose) Terminal.write("No clients connected to send update!");
            return
        }

        const message = frameWebSocketMessage({
            action: "update",
            filename: "/" + path.relative(Information.root.location, node.location),
        });

        connectedClients.forEach((socketNode, socket) => {
            if (socketNode.name !== node.name)
            {
                if (!node?.descendants.some(n => n.name === socketNode.name)) return;
            }

            if (!socket || !socket.writable)
            {
                if (Arguments.verbose) Terminal.error(Terminal.blue("socket"), "[error] could not find client");
                connectedClients.delete(socket);
                return;
            }

            socket.write(message);
        });
    }
    catch (e)
    {
        console.log('[socket error]', e);
    }
}

export function error(filename: string, errors: any[]) {
    // notify all clients 
    if (connectedClients.size === 0)
    {
        if (Arguments.verbose) Terminal.write("No clients connected to send error!");
    }

    const message = frameWebSocketMessage({ action: 'error', filename, error: errors });
    write(message);
}

// helper functions
function write(message: Buffer<ArrayBufferLike>) {
    connectedClients.forEach((_, socket) => {

        if (!socket || !socket.writable)
        {
            if (Arguments.verbose) Terminal.error(Terminal.blue("socket"), "[error] could not find client");
            connectedClients.delete(socket);
            return;
        }

        socket.write(message);
    });
}

function frameWebSocketMessage(data: unknown): Buffer {
    const payload = Buffer.from(JSON.stringify(data), "utf8");
    const len = payload.length;

    let headerLength = 2;

    if (len > 125 && len <= 0xffff) headerLength += 2;
    else if (len > 0xffff) headerLength += 8;

    const frame = Buffer.alloc(headerLength + len);

    // FIN + text frame
    frame[0] = 0x81;

    let offset = 2;

    if (len <= 125)
    {
        frame[1] = len;
    } else if (len <= 0xffff)
    {
        frame[1] = 126;
        frame.writeUInt16BE(len, offset);
        offset += 2;
    } else
    {
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(len), offset);
        offset += 8;
    }

    payload.copy(frame, offset);

    return frame;
}

function parseWebSocketFrame(buffer: Buffer): { opcode: number; payload: Buffer } {
    const firstByte = buffer[0];
    const secondByte = buffer[1];

    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;

    let offset = 2;

    // Extended payload length (matches your framing logic)
    if (payloadLength === 126)
    {
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
    } else if (payloadLength === 127)
    {
        payloadLength = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
    }

    // Clients MUST mask payload, so we expect masked = true
    if (!masked)
    {
        throw new Error("Expected masked frame from client");
    }

    // Read masking key
    const maskingKey = buffer.slice(offset, offset + 4);
    offset += 4;

    // Read and unmask payload
    const maskedPayload = buffer.slice(offset, offset + payloadLength);
    const unmasked = Buffer.alloc(payloadLength);

    for (let i = 0; i < payloadLength; i++)
    {
        unmasked[i] = maskedPayload[i] ^ maskingKey[i % 4];
    }

    return {
        opcode,
        payload: unmasked
    };
}