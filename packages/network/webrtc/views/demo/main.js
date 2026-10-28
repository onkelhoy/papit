import { Client } from '@papit/webrtc';

const $ = (id) => document.getElementById(id);
const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const LOG_LIMIT = 500;
const STORE = "papit-webrtc-demo";
const SYSTEM = "messages"; // tab for client.send / broadcast over _system

const STATUS_TEXT = {
    connecting: "connecting…",
    waking: "waking up server…",
    connected: "connected",
    reconnecting: "reconnecting…",
    closed: "disconnected",
};

const PRESETS = {
    chat: { plan: { channels: { chat: { ordered: true } }, streams: {} }, screens: [] },
    call: { plan: { channels: { chat: { ordered: true } }, streams: { camera: { kind: "video" }, mic: { kind: "audio" } } }, screens: [] },
    game: { plan: { channels: { chat: { ordered: true }, state: { ordered: false, maxRetransmits: 0 } }, streams: {} }, screens: [] },
    screen: { plan: { channels: { chat: { ordered: true } }, streams: { screen: { kind: "video" } } }, screens: ["screen"] },
    none: { plan: { channels: {}, streams: {} }, screens: [] },
};

let client = null;
let connectedUrl = null;

// ############ storage ############
function load() {
    try
    {
        return JSON.parse(localStorage.getItem(STORE) ?? "{}") ?? {};
    }
    catch
    {
        return {};
    }
}

function save(patch) {
    try
    {
        localStorage.setItem(STORE, JSON.stringify({ ...load(), ...patch }));
    }
    catch
    {
        // private mode or blocked storage: the demo works without it
    }
}

// ############ helpers ############
function time() {
    const el = document.createElement("time");
    el.textContent = new Date().toLocaleTimeString();
    return el;
}

function append(list, item) {
    list.append(item);
    while (list.children.length > LOG_LIMIT) list.firstElementChild.remove();
    list.scrollTop = list.scrollHeight;
}

function safe(value) {
    try
    {
        return typeof value === "string" ? value : JSON.stringify(value);
    }
    catch
    {
        return String(value);
    }
}

function log(kind, text, detail) {
    if (kind === "debug" && !$("verbose").checked) return;

    const li = document.createElement("li");
    li.className = kind;
    li.append(time(), `${kind}: ${text}`);
    if (detail !== undefined && detail !== null) li.title = safe(detail);
    append($("log"), li);
    if (kind === "error") console.warn("[webrtc-demo]", text, detail);
}

function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children.filter(c => c !== null && c !== undefined));
    return node;
}

function tag(text, kind = "") {
    return el("span", { className: `tag ${kind}`, textContent: text });
}

function short(id) {
    return id && id.length > 10 ? id.slice(0, 6) + "…" : (id ?? "-");
}

/** A member's display name from its profile, or a short id. */
function nameOf(peer) {
    if (!peer) return "-";
    if (client && peer === client.id) return client.profile()?.name || "you";
    const name = client?.profile(peer)?.name;
    return typeof name === "string" && name ? name : short(peer);
}

function displayName() {
    const name = $("display-name").value.trim();
    return name || `guest-${Math.random().toString(36).slice(2, 6)}`;
}

/** The topology option: a name, or a config for multicast. */
function topologyOption() {
    const name = $("topology").value;
    return name === "multicast" ? { name, fanout: Number($("fanout").value) } : name;
}

/** NetworkInfo.topology as text: `mesh`, or `multicast (fanout: 5)`. */
function topologyLabel(topology) {
    if (typeof topology === "string") return topology;
    const { name, ...config } = topology;
    const options = Object.entries(config).map(([key, value]) => `${key}: ${value}`).join(", ");
    return options ? `${name} (${options})` : name;
}

function summary(media) {
    const streams = Object.keys(media?.streams ?? {});
    const channels = Object.keys(media?.channels ?? {});
    const parts = [];
    if (streams.length) parts.push(`streams: ${streams.join(", ")}`);
    if (channels.length) parts.push(`channels: ${channels.join(", ")}`);
    return parts.join(" · ") || "no media";
}

// ############ plan editor ############
/** Builds an editor into `host`; returns { get, set } where get() is null while invalid. */
function planEditor(host) {
    const root = $("plan-editor").content.firstElementChild.cloneNode(true);
    host.replaceChildren(root);

    const channels = root.querySelector(".channels tbody");
    const streams = root.querySelector(".streams tbody");
    const error = root.querySelector(".plan-error");

    function channelRow(label = "", init = { ordered: true }) {
        const reliability = init.maxRetransmits !== undefined ? "retransmits" : init.maxPacketLifeTime !== undefined ? "lifetime" : "reliable";
        const tr = el("tr");
        const labelInput = el("input", { value: label, placeholder: "label", maxLength: 64, spellcheck: false });
        const ordered = el("input", { type: "checkbox", checked: init.ordered !== false });
        const mode = el("select", {},
            el("option", { value: "reliable", textContent: "reliable" }),
            el("option", { value: "retransmits", textContent: "maxRetransmits" }),
            el("option", { value: "lifetime", textContent: "maxPacketLifeTime ms" }),
        );
        mode.value = reliability;
        const amount = el("input", { type: "number", min: 0, step: 1, value: init.maxRetransmits ?? init.maxPacketLifeTime ?? 0 });
        amount.hidden = reliability === "reliable";
        mode.addEventListener("change", () => { amount.hidden = mode.value === "reliable"; validate(); });

        const remove = el("button", { type: "button", textContent: "×", title: "remove" });
        remove.addEventListener("click", () => { tr.remove(); validate(); });

        tr.append(el("td", {}, labelInput), el("td", {}, ordered), el("td", {}, el("div", { className: "reliability" }, mode, amount)), el("td", {}, remove));
        tr.read = () => {
            const value = { ordered: ordered.checked };
            const n = Number(amount.value);
            if (mode.value === "retransmits") value.maxRetransmits = n;
            if (mode.value === "lifetime") value.maxPacketLifeTime = n;
            return [labelInput.value.trim(), value, labelInput, n];
        };
        tr.addEventListener("input", validate);
        channels.append(tr);
    }

    function streamRow(name = "", kind = "video", screen = false) {
        const tr = el("tr");
        const nameInput = el("input", { value: name, placeholder: "name", maxLength: 64, spellcheck: false });
        const kindSelect = el("select", {}, el("option", { value: "video", textContent: "video" }), el("option", { value: "audio", textContent: "audio" }));
        kindSelect.value = kind;
        const screenBox = el("input", { type: "checkbox", checked: screen, title: "capture with getDisplayMedia" });
        const remove = el("button", { type: "button", textContent: "×", title: "remove" });
        remove.addEventListener("click", () => { tr.remove(); validate(); });

        tr.append(el("td", {}, nameInput), el("td", {}, kindSelect), el("td", {}, screenBox), el("td", {}, remove));
        tr.read = () => [nameInput.value.trim(), { kind: kindSelect.value }, screenBox.checked, nameInput];
        tr.addEventListener("input", validate);
        tr.addEventListener("change", validate);
        streams.append(tr);
    }

    function collect() {
        const plan = { channels: {}, streams: {} };
        const screens = [];
        const problems = [];

        for (const tr of channels.children)
        {
            const [label, init, input, n] = tr.read();
            let bad = "";
            if (!label) bad = "a channel needs a label";
            else if (label.startsWith("_")) bad = `"${label}": labels starting with "_" are reserved`;
            else if (label in plan.channels) bad = `"${label}" is listed twice`;
            else if (!Number.isInteger(n) || n < 0) bad = `"${label}": the limit must be a whole number ≥ 0`;
            input.setAttribute("aria-invalid", String(!!bad));
            if (bad) problems.push(bad);
            else plan.channels[label] = init;
        }
        for (const tr of streams.children)
        {
            const [name, stream, screen, input] = tr.read();
            let bad = "";
            if (!name) bad = "a stream needs a name";
            else if (name in plan.streams) bad = `stream "${name}" is listed twice`;
            input.setAttribute("aria-invalid", String(!!bad));
            if (bad) problems.push(bad);
            else
            {
                plan.streams[name] = stream;
                if (screen) screens.push(name);
            }
        }
        if (channels.children.length > 16 || streams.children.length > 16) problems.push("at most 16 channels and 16 streams");
        return { plan, screens, problems };
    }

    function validate() {
        const { problems } = collect();
        error.hidden = problems.length === 0;
        error.textContent = problems.join(". ");
        host.dispatchEvent(new Event("plan-change"));
        return problems.length === 0;
    }

    function set(plan = {}, screens = []) {
        channels.replaceChildren();
        streams.replaceChildren();
        for (const [label, init] of Object.entries(plan.channels ?? {})) channelRow(label, init);
        for (const [name, { kind }] of Object.entries(plan.streams ?? {})) streamRow(name, kind, screens.includes(name));
        validate();
    }

    root.querySelector(".add-channel").addEventListener("click", () => { channelRow("", { ordered: true }); validate(); });
    root.querySelector(".add-stream").addEventListener("click", () => { streamRow(); validate(); });
    for (const button of root.querySelectorAll("[data-preset]"))
    {
        button.addEventListener("click", () => {
            const preset = PRESETS[button.dataset.preset];
            set(preset.plan, preset.screens);
        });
    }

    return {
        get() {
            const result = collect();
            return result.problems.length ? null : result;
        },
        set,
    };
}

const createEditor = planEditor($("create-plan"));
const editEditor = planEditor($("edit-plan-editor"));
$("create-plan").addEventListener("plan-change", () => { $("create-button").disabled = !createEditor.get(); });
$("edit-plan-editor").addEventListener("plan-change", () => { $("save-plan").disabled = !editEditor.get(); });

// ############ status ############
function showStatus(status) {
    const badge = $("status");
    badge.dataset.state = status ?? "offline";
    badge.textContent = status ? STATUS_TEXT[status] : "offline";
    $("whoami").textContent = client?.id ? `you are ${nameOf(client.id)} (${short(client.id)})` : "";
    $("connect").disabled = !!client && client.status !== "closed";
    $("disconnect").disabled = !client;
}

// ############ client ############
function connect() {
    const url = $("url").value.trim();
    if (client && client.status !== "closed" && connectedUrl === url) return client;
    if (client?.network) return client;

    disconnect(true);
    const name = displayName();
    $("display-name").value = name;
    save({ url, name });

    try
    {
        client = new Client({
            url,
            profile: { name },
            rtc: $("stun").checked ? STUN : undefined,
            topology: topologyOption(),
        });
    }
    catch (error)
    {
        log("error", `bad server url: ${error.message}`);
        client = null;
        showStatus(null);
        return null;
    }

    connectedUrl = url;
    wire(client);
    showStatus(client.status);
    client.ready.then(
        (id) => log("info", `connected, your id is ${id}`),
        (error) => log("error", `${error.message}. Is the signal server running at ${url}?`),
    );
    return client;
}

function disconnect(silent) {
    if (!client) return;
    const c = client;
    client = null;
    connectedUrl = null;
    c.close();
    resetRoom();
    showStatus(null);
    render();
    if (!silent) log("info", "disconnected");
}

async function action(name, run) {
    try
    {
        const c = connect();
        if (!c) return;
        await c.ready;
        await run(c);
    }
    catch (error)
    {
        log("error", `${name} failed: ${error.message}`);
    }
    render();
}

function wire(c) {
    c.addEventListener("status", (event) => {
        if (c !== client) return;
        showStatus(event.detail);
        log(event.detail === "connected" ? "info" : "debug", `status: ${STATUS_TEXT[event.detail]}`);
    });
    c.addEventListener("message", (event) => {
        const { sender, payload, meta } = event.detail;
        const text = typeof payload?.text === "string" ? payload.text : safe(payload);
        addMessage(SYSTEM, nameOf(sender), text, meta.receiver !== "*");
    });
    c.addEventListener("peer", (event) => { log("info", `linked to ${nameOf(event.detail)}`); render(); });
    c.addEventListener("peer-left", (event) => { log("info", `link to ${nameOf(event.detail)} closed`); render(); });
    c.addEventListener("members", () => render());
    c.addEventListener("host", (event) => { log("info", `host is ${nameOf(event.detail)}`); render(); });
    c.addEventListener("unreachable", (event) => log("error", `unreachable: ${short(event.detail.receiver)}`, event.detail));
    c.addEventListener("drop", (event) => log("debug", `dropped ${event.detail.meta.type} from ${short(event.detail.meta.sender)}`));
    c.addEventListener("error", (event) => log("error", `${event.detail.type}: ${event.detail.message}`, event.detail.payload));
    c.addEventListener("debug", (event) => log("debug", `${event.detail.type}: ${event.detail.message}`));

    c.media.addEventListener("stream", (event) => {
        const { peer, name, stream } = event.detail;
        log("info", `receiving ${name} from ${nameOf(peer)}`);
        tile(`${peer}/${name}`, peer, name, stream, false);
    });
    c.media.addEventListener("stream-ended", (event) => removeTile(`${event.detail.peer}/${event.detail.name}`));
    c.media.addEventListener("capture", (event) => { tile(`me/${event.detail.name}`, c.id, event.detail.name, event.detail.stream, true); renderStreams(); });
    c.media.addEventListener("capture-ended", (event) => { removeTile(`me/${event.detail.name}`); renderStreams(); });
    c.media.addEventListener("channel-open", (event) => { log("debug", `channel ${event.detail.label} open to ${nameOf(event.detail.peer)}`); renderTabs(); });
    c.media.addEventListener("channel-close", (event) => log("debug", `channel ${event.detail.label} closed to ${nameOf(event.detail.peer)}`));
}

// ############ lobby ############
function renderNetworks(networks) {
    const list = $("networks");
    list.replaceChildren();
    if (networks.length === 0)
    {
        list.append(el("li", { className: "empty", textContent: "no public networks. Create one!" }));
        return;
    }
    for (const network of networks)
    {
        const lock = network.meta?.locked ? "🔒 " : "";
        const info = el("div", {},
            el("strong", { textContent: `${lock}${network.name}` }),
            el("span", { className: "sub", textContent: `${topologyLabel(network.topology)} · ${network.size} member${network.size === 1 ? "" : "s"} · ${summary(network.media)}` }),
        );
        const join = el("button", { textContent: "Join", className: "primary" });
        join.addEventListener("click", () => joinNetwork(network.id));
        list.append(el("li", {}, info, join));
    }
}

function joinNetwork(id) {
    return action("join", async (c) => {
        if (!id) throw new Error("pick a network or paste its id");
        log("info", `joining ${short(id)}…`);
        const network = await c.join(id, $("join-password").value || undefined);
        log("info", `joined ${network.name}`);
        enterRoom();
    });
}

// ############ room ############
const tabs = new Map(); // label -> { entries: [], unread: 0 }
let activeTab = SYSTEM;
const listening = new WeakSet();

function screensOf(network) {
    return Array.isArray(network?.meta?.screens) ? network.meta.screens : [];
}

function enterRoom() {
    activeTab = SYSTEM;
    tabs.clear();
    render();
}

function resetRoom() {
    clearTiles();
    tabs.clear();
    $("tab-log").replaceChildren();
}

function tabFor(label) {
    if (!tabs.has(label)) tabs.set(label, { entries: [], unread: 0 });
    return tabs.get(label);
}

function addMessage(label, from, text, direct) {
    const tab = tabFor(label);
    tab.entries.push({ at: new Date().toLocaleTimeString(), from, text, direct });
    if (tab.entries.length > LOG_LIMIT) tab.entries.shift();
    if (label === activeTab) appendEntry(tab.entries.at(-1));
    else
    {
        tab.unread++;
        renderTabs();
    }
}

function appendEntry({ at, from, text, direct }) {
    const li = el("li", {},
        el("time", { textContent: at }),
        el("span", { className: direct ? "from direct" : "from", textContent: `${from}${direct ? " (direct)" : ""}: ` }),
        text,
    );
    append($("tab-log"), li);
}

function listen(label) {
    const channel = client.media.channel(label);
    if (listening.has(channel)) return;
    listening.add(channel);
    channel.addEventListener("message", (event) => {
        const { peer, data } = event.detail;
        addMessage(label, nameOf(peer), typeof data === "string" ? data : `${data.byteLength} bytes`, false);
    });
}

function renderTabs() {
    if (!client?.network) return;
    const labels = [SYSTEM, ...Object.keys(client.media.plan.channels ?? {}).sort()];
    if (!labels.includes(activeTab)) activeTab = SYSTEM;

    const nav = $("tabs");
    nav.replaceChildren();
    for (const label of labels)
    {
        if (label !== SYSTEM) listen(label);
        const tab = tabFor(label);
        const button = el("button", { role: "tab", textContent: label === SYSTEM ? "messages (_system)" : label });
        button.setAttribute("aria-selected", String(label === activeTab));
        if (tab.unread) button.append(el("span", { className: "unread", textContent: `(${tab.unread})` }));
        button.addEventListener("click", () => {
            activeTab = label;
            tab.unread = 0;
            $("tab-log").replaceChildren();
            for (const entry of tab.entries) appendEntry(entry);
            renderTabs();
        });
        nav.append(button);
    }

    const hint = $("tab-hint");
    if (activeTab === SYSTEM)
    {
        hint.textContent = "client.send / broadcast: routed by the topology, relayed by peers, falls back to the server.";
    }
    else
    {
        const init = client.media.plan.channels[activeTab];
        const mode = init.maxRetransmits !== undefined ? `maxRetransmits ${init.maxRetransmits}` : init.maxPacketLifeTime !== undefined ? `maxPacketLifeTime ${init.maxPacketLifeTime}ms` : "reliable";
        const open = client.media.channel(activeTab).peers.length;
        hint.textContent = `raw data channel, ${init.ordered === false ? "unordered" : "ordered"}, ${mode}. Direct links only: open to ${open} peer${open === 1 ? "" : "s"}.`;
    }

    const target = $("tab-target");
    const selected = target.value;
    target.replaceChildren(el("option", { value: "*", textContent: "everyone" }));
    for (const id of client.members)
    {
        if (id !== client.id) target.append(el("option", { value: id, textContent: nameOf(id) }));
    }
    target.value = [...target.options].some(o => o.value === selected) ? selected : "*";
}

function renderMembers() {
    const list = $("members");
    list.replaceChildren();
    for (const id of client.members)
    {
        const left = el("div", {},
            el("strong", { textContent: nameOf(id) }),
            id === client.id ? tag("you", "you") : null,
            id === client.host ? tag("host", "host") : null,
            el("span", { className: "sub", textContent: short(id) }),
        );
        const state = id === client.id ? null : client.links.includes(id) ? tag("direct link", "linked") : tag("via relay");
        list.append(el("li", {}, left, state));
    }
}

function renderStreams() {
    const controls = $("stream-controls");
    controls.replaceChildren();
    if (!client?.network) return;

    const streams = Object.entries(client.media.plan.streams ?? {});
    if (streams.length === 0)
    {
        controls.append(el("span", { className: "muted", textContent: "No streams in this network's plan." }));
        return;
    }

    const local = client.media.streams();
    const screens = screensOf(client.network);
    for (const [name, { kind }] of streams)
    {
        const running = local.has(name);
        const screen = screens.includes(name) || name === "screen";
        const button = el("button", {
            className: running ? "danger" : "",
            textContent: `${running ? "Stop" : "Start"} ${name} (${screen ? "screen" : kind})`,
        });
        button.addEventListener("click", async () => {
            button.disabled = true;
            try
            {
                if (running) client.media.stop(name);
                else await client.media.start(name, screen ? { display: true } : undefined);
            }
            catch (error)
            {
                log("error", `${name}: ${error.message}`);
            }
            renderStreams();
        });
        controls.append(button);
    }
}

const tiles = new Map(); // key -> { figure, peer, name }

function tile(key, peer, name, stream, local) {
    removeTile(key);
    const figure = el("figure");
    if (stream.getVideoTracks().length === 0) figure.classList.add("audio");

    const video = el("video", { autoplay: true, playsInline: true, muted: local, srcObject: stream });
    video.play().catch(() => log("info", "click anywhere to allow playback"));
    const caption = el("figcaption");
    figure.append(video, caption);
    $("grid").append(figure);
    tiles.set(key, { figure, caption, peer, name, local });
    labelTiles();
}

function labelTiles() {
    for (const { caption, peer, name, local } of tiles.values())
    {
        caption.textContent = `${local ? "you" : nameOf(peer)} · ${name}`;
    }
}

function removeTile(key) {
    const entry = tiles.get(key);
    if (!entry) return;
    entry.figure.querySelector("video").srcObject = null;
    entry.figure.remove();
    tiles.delete(key);
}

function clearTiles() {
    for (const key of [...tiles.keys()]) removeTile(key);
}

function render() {
    const inRoom = !!client?.network;
    $("lobby").hidden = inRoom;
    $("room").hidden = !inRoom;
    showStatus(client?.status ?? null);
    if (!inRoom) return;

    const network = client.network;
    $("room-title").textContent = network.name;
    if (document.activeElement !== $("room-name")) $("room-name").value = client.profile()?.name ?? "";
    $("room-meta").textContent = `${topologyLabel(network.topology)} · ${client.members.length} member${client.members.length === 1 ? "" : "s"} · ${summary(client.media.plan)} · id ${network.id}`;
    $("edit-plan").hidden = client.host !== client.id;

    renderMembers();
    renderStreams();
    renderTabs();
    labelTiles();
}

// ############ controls ############
$("connect").addEventListener("click", () => connect());
$("disconnect").addEventListener("click", () => disconnect());

function rename(name) {
    name = name.trim();
    if (!name) return;
    $("display-name").value = name;
    $("room-name").value = name;
    save({ name });
    if (client?.setProfile({ ...client.profile(), name })) render();
}

$("display-name").addEventListener("change", () => rename($("display-name").value));
$("rename").addEventListener("submit", (event) => {
    event.preventDefault();
    rename($("room-name").value);
});

$("create-button").addEventListener("click", () => action("create", async (c) => {
    const result = createEditor.get();
    if (!result) throw new Error("fix the media plan first");

    const password = $("create-password").value;
    save({ plan: result.plan, screens: result.screens, topology: $("topology").value });
    const network = await c.create({
        name: $("network-name").value.trim() || "network",
        private: $("private").checked,
        media: result.plan,
        meta: { screens: result.screens, locked: !!password },
        ...(password ? { password } : {}),
    });
    log("info", `created ${network.name} (${network.id}). Share the id for private networks.`);
    enterRoom();
}));

$("refresh").addEventListener("click", () => action("list", async (c) => renderNetworks(await c.list())));
$("join-id").addEventListener("click", () => joinNetwork($("network-id").value.trim()));

$("leave").addEventListener("click", () => {
    client?.leave();
    resetRoom();
    log("info", "left the network");
    render();
});

$("edit-plan").addEventListener("click", () => {
    editEditor.set(client.media.plan, screensOf(client.network));
    $("plan-dialog").showModal();
});

$("plan-dialog").addEventListener("close", () => {
    if ($("plan-dialog").returnValue !== "save") return;
    action("update media", async (c) => {
        const result = editEditor.get();
        if (!result) throw new Error("the plan is invalid");
        save({ plan: result.plan, screens: result.screens });
        await c.update({ media: result.plan, meta: { ...(c.network.meta ?? {}), screens: result.screens } });
        log("info", `media plan updated: ${summary(result.plan)}`);
    });
});

$("tab-send").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("tab-text").value;
    if (!text || !client?.network) return;

    const target = $("tab-target").value;
    let ok;
    if (activeTab === SYSTEM)
    {
        ok = target === "*" ? client.broadcast("chat", { text }) : client.send(target, "chat", { text });
    }
    else
    {
        const channel = client.media.channel(activeTab);
        ok = target === "*" ? channel.broadcast(text) > 0 : channel.send(target, text);
    }
    addMessage(activeTab, target === "*" ? "you" : `you → ${nameOf(target)}`, text, target !== "*");
    if (!ok) log("error", activeTab === SYSTEM ? "message could not be routed" : `"${activeTab}" isn't open to ${target === "*" ? "anyone" : nameOf(target)} yet (direct links only)`);
    $("tab-text").value = "";
});

$("clear").addEventListener("click", () => $("log").replaceChildren());

window.addEventListener("beforeunload", () => client?.close());
window.demo = { get client() { return client; } };

// ############ restore ############
const stored = load();
if (typeof stored.url === "string") $("url").value = stored.url;
if (typeof stored.name === "string") $("display-name").value = stored.name;
if (typeof stored.topology === "string") $("topology").value = stored.topology;
const showFanout = () => { $("fanout-field").hidden = $("topology").value !== "multicast"; };
$("topology").addEventListener("change", showFanout);
showFanout();
createEditor.set(stored.plan ?? PRESETS.call.plan, Array.isArray(stored.screens) ? stored.screens : []);
render();
