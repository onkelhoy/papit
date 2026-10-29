import { describe, it } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { Information } from "@papit/information";
import { getURL } from "@papit/server";

describe("getURL", () => {
    it("ignores the query string", () => {
        const url = getURL({ url: "/package.json?signal=ws://x" });
        assert.strictEqual(path.basename(url.absolute), "package.json");
        assert.strictEqual(url.absolute, getURL({ url: "/package.json" }).absolute);
    });

    it("ignores the hash", () => {
        const url = getURL({ url: "/package.json#top" });
        assert.strictEqual(url.absolute, getURL({ url: "/package.json" }).absolute);
    });

    it("strips the query from the request so later handlers see the path", () => {
        const request = { url: "/package.json?a=1" };
        getURL(request);
        assert.strictEqual(request.url, "/package.json");
    });
});
