import { Client, Handshake, SocketLink, chord, ring } from '@papit/webrtc';
import { Message, SignalType } from '@papit/peer-message';

/** Resolves once the event fires on target, with its detail. */
function once(target, type, match = () => true) {
  return new Promise(resolve => {
    const handle = (event) => {
      if (!match(event.detail)) return;
      target.removeEventListener(type, handle);
      resolve(event.detail);
    };
    target.addEventListener(type, handle);
  });
}

/** Resolves once check() is true, rejects after a while. */
async function until(check, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (!check())
  {
    if (Date.now() > end) throw new Error(`timed out waiting for ${check}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** Two clients in one network, both logging their debug events. */
async function pair(url, options = {}, before = () => { }) {
  const make = () => new Client({ url, wake: false, ...options });
  const a = make();
  const b = make();
  const log = [];
  for (const client of [a, b]) client.addEventListener("debug", (event) => log.push(event.detail.message));
  await Promise.all([a.ready, b.ready]);
  before(a, b);
  const network = await a.create({ name: "test" });
  await b.join(network.id);
  return { a, b, log, network };
}

/** A network of `size` clients. The first is the host; everyone's links are up on return. */
async function group(url, size, options = {}, name = "test", create = {}) {
  const make = () => new Client({ url, wake: false, acceptMerge: () => true, ...options });
  const clients = Array.from({ length: size }, make);
  await Promise.all(clients.map(client => client.ready));
  const [host, ...rest] = clients;
  const network = await host.create({ name, ...create });
  for (const client of rest)
  {
    await client.join(network.id, create.password);
    await settled(clients.slice(0, clients.indexOf(client) + 1));
  }
  return { clients, host, network };
}

/** Resolves once every client holds every link its topology wants and no link is opening. */
function settled(clients, timeout = 15_000) {
  return until(() => clients.every(client => client.router.desired().length === 0 && client.pending.size === 0), timeout);
}

/** Handshake over a stand-in connection, so a test sets its states by hand. */
function fakeHandshake(ice, timeout) {
  const connection = Object.assign(new EventTarget(), {
    signalingState: "stable",
    iceConnectionState: ice,
    iceGatheringState: "complete",
    connectionState: "connecting",
    localDescription: { toJSON: () => ({ type: "offer", sdp: "o" }) },
    setLocalDescription: async () => { },
  });
  const channel = Object.assign(new EventTarget(), { readyState: "connecting" });
  const network = Object.assign(new EventTarget(), { send: () => true });
  return { handshake: new Handshake("a", "b", connection, channel, network, undefined, timeout), channel };
}

Object.assign(window, { Client, Handshake, SocketLink, chord, ring, pair, group, settled, fakeHandshake, Message, SignalType, once, until });
window.ready = true;
