import { describe, it as test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

import {
    SocketServer,
    IncomingMessageType,
    MessageType,
    OutgoingMessageType,
} from '@papit/signal-server';

// ############ SETUP #####################

const openSockets = [];
let httpserver;
let socketserver;
let idticker = 0;
const logs = {
    errors: [],
    logs: [],
};

before(async () => {
    console.log = (...args) => logs.logs.push(args.join(' '));
    console.error = (...args) => logs.errors.push(args.join(' '));

    await new Promise((rs) => {
        httpserver = http.createServer();
        httpserver.listen(8888, () => {
            console.log('Server Startup');
            rs();
        });
    });
});

after(async () => {
    await new Promise(resolve => httpserver.close(resolve));
    console.log('Server teardown');
});

beforeEach(() => {
    socketserver = new SocketServer({
        server: httpserver,
        setClientID: () => {
            idticker++;
            return idticker.toString();
        },
    });
});

afterEach(async () => {
    idticker = 0;
    socketserver.close();

    for (const socket of openSockets)
    {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
        {
            socket.close();
        }
    }
    openSockets.length = 0; // Clear for next test

    await wait();
});

// ################## TESTS #####################

describe('Core Functionalities', () => {
    test('Should accept connection', async () => {
        const { socket } = getSocket();
        await wait();

        assert.strictEqual(socketserver.sockets.size, 1);
        assert.strictEqual(socket.readyState, WebSocket.OPEN);
    });

    test('Assigning custom IDs', async () => {
        socketserver.close();
        socketserver = new SocketServer({
            server: httpserver,
            setClientID: () => '55555',
        });
        await wait();
        getSocket();
        await wait();

        const socket = socketserver.sockets.get('55555');
        assert.strictEqual(socket?.id, '55555');
    });

    test('Duplicate Id', async () => {
        socketserver.close();
        socketserver = new SocketServer({
            server: httpserver,
            setClientID: () => '55555',
        });
        await wait();
        getSocket();
        await wait();
        getSocket();
        await wait();

        assert.strictEqual(socketserver.sockets.size, 1);
    });

    test('register network', async () => {
        const { socket } = getSocket();
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something' }
        }));
        await wait();

        assert.strictEqual(socketserver.hosts.size, 1);
        assert.deepStrictEqual(socketserver.networks.get('1')?.name, 'something');
    });

    test('register network with specified id', async () => {
        const { socket } = getSocket();
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something', id: 'custom-id' }
        }));
        await wait();

        assert.strictEqual(socketserver.networks.size, 1);
        assert.deepStrictEqual(socketserver.networks.get('custom-id')?.name, 'something');
    });

    test('register multiple networks', async () => {
        const { socket } = getSocket();
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something', id: 'blabla1' }
        }));
        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something', id: 'blabla2' }
        }));
        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something', id: 'blabla3' }
        }));
        await wait();

        assert.strictEqual(socketserver.hosts.size, 1);
        assert.deepStrictEqual(socketserver.hosts.get('1'), ['blabla1', 'blabla2', 'blabla3']);
        assert.strictEqual(socketserver.networks.size, 3);

        socket.close();
        await wait();

        assert.strictEqual(socketserver.hosts.size, 0);
        assert.strictEqual(socketserver.networks.size, 0);
    });

    test('host leave should result in network gone', async () => {
        const { socket } = getSocket();
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something' }
        }));
        await wait();
        socket.close();
        await wait();

        assert.strictEqual(socketserver.hosts.size, 0);
        assert.strictEqual(socketserver.networks.size, 0);
    });

    test('Should prevent spamming', async () => {
        const { socket } = getSocket();
        await wait();

        for (let i = 0; i < 6; i++)
        {
            socket.send('hello world');
        }
        await wait();

        assert.strictEqual(socket.readyState, WebSocket.CLOSED);
    });

    test('Reset spamming', async () => {
        const { socket } = getSocket();
        await wait();

        for (let i = 0; i < 4; i++)
        {
            socket.send('hello world');
        }
        await wait(1500);
        socket.send('hello world');
        socket.send('hello world');
        await wait();

        assert.strictEqual(socket.readyState, WebSocket.OPEN);
    });

    test('Network should be updated', async () => {
        const { socket } = getSocket();
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Register,
            network: { name: 'something' }
        }));
        await wait();

        socket.send(JSON.stringify({
            type: IncomingMessageType.Update,
            network: { name: 'something-else' }
        }));
        await wait();

        assert.deepStrictEqual(socketserver.networks.get('1')?.name, 'something-else');
    });
});

describe('Checking responses', () => {
    test('newly connected sockets should receive their id', async () => {
        const { messages } = getSocket();
        await wait();

        assert.strictEqual(messages[OutgoingMessageType.ConnectionACK].length, 1);
        assert.deepStrictEqual(messages[OutgoingMessageType.ConnectionACK][0].id, '1');
    });

    test('successful register should be recognized by register-ack', async () => {
        const { socket, messages } = getSocket();
        await wait();

        send(socket, {
            type: IncomingMessageType.Register,
            network: { name: 'hello' }
        });
        await wait();

        assert.strictEqual(messages[OutgoingMessageType.RegisterACK].length, 1);
        assert.deepStrictEqual(messages[OutgoingMessageType.RegisterACK][0].network, {
            name: 'hello',
            id: '1',
            host: '1'
        });
    });

    test('successful update of network should be recognized by update-ack', async () => {
        const { socket, messages } = getSocket();
        await wait();

        send(socket, {
            type: IncomingMessageType.Register,
            network: { name: 'hello' }
        });
        await wait();
        send(socket, {
            type: IncomingMessageType.Update,
            network: { name: 'hello-updated' }
        });
        await wait();

        assert.strictEqual(messages[OutgoingMessageType.UpdateACK].length, 1);
        assert.deepStrictEqual(messages[OutgoingMessageType.UpdateACK][0].network, {
            name: 'hello-updated',
            id: '1',
            host: '1'
        });
    });

    test('unsuccessful update of network should get error', async () => {
        const { socket, messages } = getSocket();
        await wait();

        send(socket, {
            type: IncomingMessageType.Update,
            network: { name: 'hello-updated' }
        });
        await wait();

        assert.strictEqual(messages[OutgoingMessageType.Error].length, 1);
        assert.deepStrictEqual(messages[OutgoingMessageType.Error][0].error, 'Host not found');
    });
});

describe('multiple clients', () => {
    test('connection', async () => {
        const a = getSocket();
        const b = getSocket();
        await wait();

        assert.strictEqual(a.messages[OutgoingMessageType.ConnectionACK].length, 1);
        assert.strictEqual(b.messages[OutgoingMessageType.ConnectionACK].length, 1);
    });
});

// ################## Helpers #####################
function getSocket() {
    const socket = new WebSocket('ws://localhost:8888');
    openSockets.push(socket); // Track for cleanup

    const messages = {
        [OutgoingMessageType.Error]: [],
        [OutgoingMessageType.RegisterACK]: [],
        [OutgoingMessageType.UpdateACK]: [],
        [OutgoingMessageType.ConnectionACK]: [],
        [MessageType.Target]: [],
    };

    socket.onmessage = function (event) {
        const message = JSON.parse(event.data);
        messages[message.type].push(message);
    };

    return { messages, socket };
}

function send(socket, message) {
    socket.send(JSON.stringify(message));
}

function wait(ms = 100) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}