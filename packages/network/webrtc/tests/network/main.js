import { Network, MemoryLink, topologies } from '@papit/webrtc';
import { Message, BROADCAST } from '@papit/peer-message';

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

Object.assign(window, { Message, BROADCAST, build, once, settle });
window.ready = true;
