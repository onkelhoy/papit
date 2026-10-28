import { describe, it } from "node:test";
import assert from "node:assert";

import { getLogoURL } from "@papit/create";

const RAW = "https://raw.githubusercontent.com/acc/repo/refs/heads/main/asset/logo.svg";

describe("getLogoURL", () => {
    it("reads a package.json repository url", () => {
        assert.strictEqual(getLogoURL("git+https://github.com/acc/repo.git"), RAW);
    });

    it("reads a plain github url", () => {
        assert.strictEqual(getLogoURL("https://github.com/acc/repo"), RAW);
        assert.strictEqual(getLogoURL("https://github.com/acc/repo/"), RAW);
    });

    it("reads an ssh url", () => {
        assert.strictEqual(getLogoURL("git@github.com:acc/repo.git"), RAW);
    });

    it("falls back to the repository's blob path for other hosts", () => {
        assert.strictEqual(getLogoURL("https://gitlab.com/acc/repo.git"), "https://gitlab.com/acc/repo/blob/main/asset/logo.svg");
    });
});
