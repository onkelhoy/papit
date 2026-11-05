import { Client, ParentBootstrap } from '@papit/webrtc';

const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const $ = (id) => document.getElementById(id);

let client = null;
/** Network → its panel. */
const panels = new Map();

function log(kind, text) {
  if (kind === "debug" && !$("verbose").checked) return;
  const line = document.createElement("div");
  line.className = kind;
  line.textContent = `${new Date().toLocaleTimeString()} ${kind === "info" ? "" : kind + " "}${text}`;
  $("log").append(line);
  $("log").scrollTop = $("log").scrollHeight;
}

function getClient() {
  if (client) return client;
  client = new Client({ url: $("url").value.trim(), rtc: $("stun").checked ? STUN : undefined });
  client.on("error", event => log("error", `${event.detail.type}: ${event.detail.message}`));
  client.on("debug", event => log("debug", `${event.detail.type}: ${event.detail.message}`));
  return client;
}

async function act(button, fn) {
  button.disabled = true;
  try
  {
    await fn();
  }
  catch (error)
  {
    log("error", `${button.textContent.toLowerCase()} failed: ${error.message}`);
  }
  finally
  {
    button.disabled = false;
  }
}

// rendering
function render() {
  $("me").textContent = client?.id ?? "not connected";
  $("online").textContent = client?.online ? "open" : "closed";
  for (const [network, panel] of panels) renderPanel(network, panel);
}

function renderPanel(network, panel) {
  const part = (name) => panel.querySelector(`[data-${name}]`);
  const { info } = network;

  part("name").textContent = info.name;
  part("id").textContent = info.id;
  part("topology").textContent = typeof info.topology === "string" ? info.topology : info.topology.name;
  part("anchored").textContent = network.anchored ? "yes" : "no";
  part("over").textContent = panel.parent ? `carried over ${panel.parent.info.id}` : "on the server";
  part("links").textContent = [...network.linked].join(", ") || "none";
  part("known").textContent = network.known().join(", ") || "none";

  // a carried network is joined by invite, so only server networks get a joining tab
  const link = part("link");
  link.hidden = !!panel.parent;
  link.href = `?url=${encodeURIComponent($("url").value)}&join=${info.id}`;

  const invite = JSON.stringify(network.invite());
  if (part("invite").value !== invite) part("invite").value = invite;

  const to = part("to");
  const selected = to.value;
  to.replaceChildren(new Option("everyone", "*"), ...[...network.linked].map(peer => new Option(peer, peer)));
  to.value = [...to.options].some(option => option.value === selected) ? selected : "*";
}

// a network and its panel
function attach(network, parent = null) {
  const panel = $("panel").content.firstElementChild.cloneNode(true);
  panel.parent = parent;
  const part = (name) => panel.querySelector(`[data-${name}]`);
  const name = () => `[${network.info.name}]`;

  network.on("link", event => {
    const { peer, open, left } = event.detail;
    log("info", `${name()} link ${peer} ${open ? "opened" : left ? "closed (left)" : "closed"}`);
    render();
  });
  network.on("message", event => {
    const { meta } = event.detail;
    log("info", `${name()} ${meta.sender}${meta.receiver === "*" ? " (to everyone)" : ""}: ${event.detail.parse().text}`);
  });
  network.on("merged", () => {
    log("info", `${name()} merged, now ${network.info.id}`);
    render();
  });
  network.on("anchored", render);
  network.on("close", () => {
    log("info", `${name()} closed`);
    panels.delete(network);
    panel.remove();
  });

  part("send").addEventListener("click", () => {
    const to = part("to").value;
    const text = part("text").value;
    if (to === "*") network.broadcast("chat", { text });
    else network.send(to, "chat", { text });
    log("info", `${name()} me → ${to === "*" ? "everyone" : to}: ${text}`);
  });

  part("carry-create").addEventListener("click", event => act(event.target, async () => {
    const bootstrap = new ParentBootstrap(network, crypto.randomUUID());
    const carried = await getClient().create({ name: part("carry-name").value, topology: part("carry-topology").value }, { bootstrap });
    log("info", `${name()} carries ${carried.info.id}, paste its invite into a tab that joined ${network.info.id}`);
    attach(carried, network);
  }));

  part("carry-join").addEventListener("click", event => act(event.target, async () => {
    const invite = JSON.parse(part("carry-invite").value);
    const bootstrap = new ParentBootstrap(network, invite.id);
    const carried = await getClient().join(invite, {}, { bootstrap });
    log("info", `${name()} joined ${invite.id} through ${[...carried.linked].join(", ")}`);
    attach(carried, network);
  }));

  part("merge").addEventListener("click", event => act(event.target, async () => {
    const target = part("merge-id").value.trim();
    await network.merge(target, part("merge-password").value || undefined);
    log("info", `${name()} merged into ${target}`);
  }));

  part("leave").addEventListener("click", () => {
    network.leave();
    log("info", `${name()} left`);
  });

  panels.set(network, panel);
  $("networks").append(panel);
  render();
}

// new networks on the server
$("create").addEventListener("click", event => act(event.target, async () => {
  const password = $("password").value;
  const created = await getClient().create({
    name: $("name").value,
    topology: $("topology").value,
    anchors: Number($("anchors").value) || 1,
    beacon: Number($("beacon").value) || 0,
    ...(password ? { password } : {}),
  });
  log("info", `created ${created.info.id}`);
  attach(created);
}));

$("join").addEventListener("click", event => act(event.target, async () => {
  const id = $("network").value.trim();
  const password = $("password").value;
  const joined = await getClient().join(id, password ? { password } : {});
  log("info", `joined ${id} through ${[...joined.linked].join(", ")}`);
  attach(joined);
}));

// the socket closes a moment after joining, and topologies learn peers quietly
setInterval(render, 1000);

const params = new URLSearchParams(location.search);
if (params.get("url")) $("url").value = params.get("url");
if (params.get("join"))
{
  $("network").value = params.get("join");
  $("join").click();
}
