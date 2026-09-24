import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Duplex } from "node:stream";
import { Information } from "@papit/information";
import { getURL, upgrade } from "@papit/server";

const root = Information.root.location;

function isInside(target) {
    const relative = path.relative(root, target);
    return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

function assertForbidden(url) {
    assert.throws(() => getURL({ url }), (e) => e.status === 403, `${url} should be rejected with 403`);
}

// a path outside the workspace that exists on every machine
const outside = fs.realpathSync(os.tmpdir());
const outsideFile = path.join(outside, `papit-traversal-${process.pid}.txt`);
fs.writeFileSync(outsideFile, "secret");
process.on("exit", () => fs.rmSync(outsideFile, { force: true }));

const levels = root.split(path.sep).length + 2;
const depth = "/..".repeat(levels);

describe("getURL path traversal", () => {
    it("does not serve an absolute path outside the workspace", () => {
        let url;
        try { url = getURL({ url: outsideFile }); }
        catch (e) { assert.strictEqual(e.status, 403); return; }
        assert.ok(isInside(url.absolute), `resolved outside the workspace: ${url.absolute}`);
    });

    it("rejects ../ leaving the workspace", () => {
        assertForbidden(depth + outsideFile);
    });

    it("rejects ../ leaving the workspace to a missing file", () => {
        assertForbidden(depth + "/papit-missing-file");
    });

    it("keeps ../ that stays inside the workspace", () => {
        const url = getURL({ url: "/../package.json" });
        assert.ok(isInside(url.absolute));
    });

    for (const encoded of [
        "/%2e%2e".repeat(levels) + outsideFile,
        "/" + "..%2f".repeat(levels) + outsideFile.slice(1),
        "/" + "%2e%2e%2f".repeat(levels) + outsideFile.slice(1),
    ])
    {
        it(`does not resolve encoded traversal outside the workspace: ${encoded.slice(0, 24)}...`, () => {
            let url;
            try { url = getURL({ url: encoded }); }
            catch (e) { assert.strictEqual(e.status, 403); return; }
            assert.ok(isInside(url.absolute), `resolved outside the workspace: ${url.absolute}`);
        });
    }
});

describe("websocket register path traversal", () => {
    let socket;

    afterEach(() => {
        mock.restoreAll();
        socket?.destroy();
    });

    function frame(data) {
        const payload = Buffer.from(JSON.stringify(data), "utf8");
        const mask = Buffer.from([1, 2, 3, 4]);
        const header = payload.length <= 125
            ? Buffer.from([0x81, 0x80 | payload.length])
            : Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
        return Buffer.concat([header, mask, masked]);
    }

    it("does not touch the filesystem outside the workspace", () => {
        socket = new Duplex({ read() { }, write(_chunk, _encoding, callback) { callback(); } });
        upgrade.call(null, { headers: { "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" } }, socket, Buffer.alloc(0));

        const exists = mock.method(fs, "existsSync");
        socket.emit("data", frame({ type: "register", location: depth + outside }));

        const touched = exists.mock.calls.map(call => String(call.arguments[0])).filter(p => !isInside(p));
        assert.deepStrictEqual(touched, []);
    });
});
