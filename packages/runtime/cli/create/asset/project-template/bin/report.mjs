import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Terminal } from "@papit/terminal";

const ACTIONS = !!process.env.GITHUB_ACTIONS;
const MAX_LOG = 20_000; // a step summary is limited to 1MB
const ICONS = { passed: "✓", flaky: "!", skipped: "-", failed: "✗" };
const COLORS = { passed: "green", flaky: "yellow", skipped: "blue", failed: "red" };

/** Where the publish build leaves the packages that failed, for publish to leave out. */
export const BUILD_FAILED = path.join(os.tmpdir(), "papit-build-failed.json");

function plain(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Runs a command and resolves with its exit code and everything it printed. */
export function run(command, cwd, env = {}) {
    return new Promise(resolve => {
        let output = "";
        const child = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });

        child.stdout.on("data", chunk => (output += chunk));
        child.stderr.on("data", chunk => (output += chunk));
        child.on("error", error => resolve({ code: 1, output: output + error.message }));
        child.on("close", code => resolve({ code, output }));
    });
}

export function seconds(start) {
    return `${Math.round((Date.now() - start) / 1000)}s`;
}

/**
 * One line per package, its logs folded away on GitHub, and a table in the run's summary at the end.
 * A failure stays unfolded, with an annotation on the PR.
 */
export class Report {
    rows = [];

    constructor(title, total) {
        this.title = title;
        this.total = total;
    }

    /** `status` is `passed`, `flaky`, `skipped` or `failed`. */
    add({ name, status, detail = "", output = "" }) {
        this.rows.push({ name, status, detail, output });

        const text = plain(output).trim();
        const line = `${ICONS[status]} ${this.rows.length}/${this.total} ${name}${detail ? ` · ${detail}` : ""}`;

        if (status === "failed" && ACTIONS) console.log(`::error title=${this.title} failed::${name}`);

        if (status === "failed")
        {
            Terminal.write(Terminal.red(line));
            if (text) Terminal.write(text.slice(-MAX_LOG));
        }
        else if (ACTIONS)
        {
            console.log(`::group::${line}\n${text}\n::endgroup::`);
        }
        else
        {
            Terminal.write(Terminal[COLORS[status]](line));
        }
    }

    /** Writes the totals, and returns true when nothing failed. */
    finish(empty = "no new packages") {
        const counts = Object.keys(ICONS)
            .map(status => [status, this.rows.filter(row => row.status === status).length])
            .filter(([, count]) => count > 0)
            .map(([status, count]) => `${count} ${status}`)
            .join(", ");
        const heading = `${this.title}: ${counts || empty}`;

        Terminal.write(`\n${heading}`);
        if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, this.markdown(heading));

        return !this.rows.some(row => row.status === "failed");
    }

    markdown(heading) {
        const lines = [`### ${heading}`, ""];

        if (this.rows.length > 0) lines.push("| | package | |", "|---|---|---|");
        for (const { name, status, detail } of this.rows) lines.push(`| ${ICONS[status]} | ${name} | ${detail} |`);
        lines.push("");

        for (const { name, status, output } of this.rows)
        {
            if (status !== "failed" && status !== "flaky") continue;
            lines.push(`<details><summary>${ICONS[status]} ${name}</summary>`, "", "```text", plain(output).trim().slice(-MAX_LOG), "```", "", "</details>", "");
        }

        return lines.join("\n") + "\n";
    }
}
