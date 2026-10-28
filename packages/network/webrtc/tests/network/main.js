import { Network, MemoryLink, topologies, multicast, multicastTopology, registerTopology, resolveTopology } from '@papit/webrtc';
import { Message, BROADCAST, SERVER, SignalType } from '@papit/peer-message';

const letters = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));

/** Builds n nodes (a, b, c, ...) and links them as topology.neighbors asks. */
function build(topology, n, host) {
  const members = letters(n);
  const nodes = {};
  const links = [];
  const log = {};

  for (const id of members)
  {
    const node = new Network({ me: id, topology });
    node.setMembers(members, host ?? members[0]);
    nodes[id] = node;

    log[id] = { message: [] };
    for (const type of Object.keys(log[id]))
    {
      node.addEventListener(type, (event) => {
        const detail = event.detail;
        log[id][type].push(detail?.meta ? structuredClone(detail.meta) : detail);
      });
    }
  }

  for (const id of members)
  {
    for (const other of nodes[id].desired())
    {
      if (nodes[other].view.links.includes(id)) continue;

      const [mine, theirs] = MemoryLink.pair(id, other);
      nodes[id].addLink(mine);
      nodes[other].addLink(theirs);
      links.push(mine, theirs);
    }
  }

  return { nodes, links, log, members };
}

/**
 * A stand-in signal server: forwards by receiver to the peers connected to it, answers
 * signal.unreachable for anyone else and counts spoofed senders (which it drops).
 */
function fakeServer() {
  const sockets = {};
  const log = { spoof: 0 };

  const connect = (id) => {
    const link = new EventTarget();
    link.id = SERVER;
    link.open = true;
    link.send = (bytes) => {
      const copy = bytes.slice();
      queueMicrotask(() => {
        const { meta } = Message.FromBinary(copy, false);
        if (meta.sender !== id) return void log.spoof++;

        const target = sockets[meta.receiver];
        if (target) return void target.dispatchEvent(new CustomEvent("message", { detail: copy }));

        const unreachable = Message.Create({ type: SignalType.Unreachable, sender: SERVER, receiver: id }, { receiver: meta.receiver, ref: meta.id });
        link.dispatchEvent(new CustomEvent("message", { detail: unreachable.toBinary(true) }));
      });
      return true;
    };
    link.close = () => {
      delete sockets[id];
      link.open = false;
      link.dispatchEvent(new Event("close"));
    };
    sockets[id] = link;
    return link;
  };

  return { connect, log };
}

/** Resolves once the event fires on target. */
function once(target, type) {
  return new Promise(resolve => target.addEventListener(type, resolve, { once: true }));
}

/**
 * Drains everything already queued. MemoryLink delivers in microtasks,
 * so after one macrotask every cascade started before it has finished.
 */
function settle() {
  return new Promise(resolve => setTimeout(resolve));
}

Object.assign(window, { Message, BROADCAST, Network, fakeServer, build, once, settle, topologies, multicast, multicastTopology, registerTopology, resolveTopology });
window.ready = true;
