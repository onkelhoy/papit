import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";

// runs `body` with stdin as a pipe, like git bash, and answers it line by line
function run(body, answers) {
    const script = `import { Terminal } from "@papit/terminal"; ${body} process.exit(0);`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { cwd: import.meta.dirname, stdio: "pipe" });

    return new Promise((resolve, reject) => {
        let stdout = "";
        const timer = setTimeout(() => { child.kill(); reject(new Error("hung, stdout: " + stdout)); }, 5000);

        child.stdout.on("data", chunk => {
            stdout += chunk;
            if (stdout.includes("?")) child.stdin.write(answers.shift() ?? "");
        });
        child.on("close", () => { clearTimeout(timer); resolve(stdout); });
    });
}

describe("Terminal without a tty", () => {
    it("prompt resolves on a bare newline", async () => {
        const stdout = await run(`const a = await Terminal.prompt("name?", true); console.log("got:" + a.input);`, ["henry\n"]);
        assert.match(stdout, /got:henry/);
    });

    it("prompt never queries the cursor", async () => {
        const stdout = await run(`await Terminal.prompt("name?", true);`, ["x\n"]);
        assert.ok(!stdout.includes("\x1b[6n"));
    });

    it("option resolves on a bare newline", async () => {
        const stdout = await run(`const a = await Terminal.option(["yes", "no"], "pick?"); console.log("got:" + a.text);`, ["\n"]);
        assert.match(stdout, /got:yes/);
    });
});
