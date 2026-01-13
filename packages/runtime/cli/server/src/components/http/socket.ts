import http from "node:http";
import { createHash } from "node:crypto";
import { Duplex } from "node:stream";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

const connectedClients = new Set<Duplex>();

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
  connectedClients.add(socket);

  if (Arguments.info) Terminal.write(Terminal.blue("client connected"));

  // events 
  socket.on("end", () => connectedClients.delete(socket));
  socket.on("close", () => connectedClients.delete(socket));
  socket.on("error", (err: any) => {
    if (err.code === "ECONNRESET") connectedClients.delete(socket);
  });
}

// exposed functions 
export function update(filename: string, content: string) {
  // notify all clients 
  try
  {
    if (connectedClients.size === 0)
    {
      if (Arguments.verbose) Terminal.write("No clients connected to send update!");
      return
    }

    const message = frameWebSocketMessage({ action: 'update', filename, content });
    write(message);
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
  connectedClients.forEach((socket) => {
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
