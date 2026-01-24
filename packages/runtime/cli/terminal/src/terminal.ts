// import statements 
import { spawn } from "node:child_process";

import { SpawnOptions } from "./types";
import { prompt } from "./methods/prompt";
import { option } from "./methods/option";
import { Colors } from "./color";

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = (chunk: any, encoding?: any, cb?: any) => {
    Terminal.track(chunk.toString());
    return originalStdoutWrite(chunk, encoding, cb);
};

process.stderr.write = (chunk: any, encoding?: any, cb?: any) => {
    Terminal.track(chunk.toString());
    return originalStderrWrite(chunk, encoding, cb);
};

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Terminal extends Colors {

    static lines: number = 0;
    static session: number | null = null;

    static loading(text = "Loading", duration = 80, callback?: (frame: number) => void) {
        let frame = 0;
        let active = true;
        let interval: NodeJS.Timeout | undefined;
        let label = text;

        const close = () => {
            if (!active) return;
            active = false;

            clearInterval(interval);

            // Clear spinner line completely
            process.stdout.write("\x1b[2K\r");
        }
        const update = (text: string) => {
            label = text;
        }
        const render = () => {
            const icon = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
            frame++;

            callback?.(frame);

            // Clear line + carriage return
            process.stdout.write("\x1b[2K\r");
            process.stdout.write(`${icon} ${label}`);
        };

        if (!process.stdout.isTTY)
        {
            this.printLine(`${label}...`);
        }
        else 
        {
            interval = setInterval(render, duration);
            render();
        }

        return { close, update };
    }

    static write(...values: any[]) {
        this.printLine(this.getString(" ", values));
    }

    static warn(...values: any[]) {
        this.semantic(`🟡 ${process.stdout.isTTY ? this.yellow("warn ") : ""}`, values);
    }

    static error(...values: any[]) {
        this.semantic(`🔴 ${process.stdout.isTTY ? this.red("error ") : ""}`, values);
    }

    private static semantic(prefix: string, values: any[]) {
        let value = this.getString(" ", values);
        const match = value.match(/^(\n)*/);

        let leading = "";
        if (match)
        {
            leading = match[0];
            value = value.slice(Math.max(0, leading.length * 2 - 1));
        }

        this.printLine(`${leading}${prefix}${value}`, "error");
    }
    static print(value: string, type: "info" | "error" = "info") {
        if (type === "error")
        {
            process.stderr.write(value);
        }
        else 
        {
            process.stdout.write(value);
        }
    }

    static track(value: string) {
        // Count newlines in the string
        const newlineCount = (value.match(/\n/g) || []).length;
        this.lines += newlineCount;
    }

    static printLine(value: string = "", type: "info" | "error" = "info") {
        this.print(value + "\n", type);
    }

    static clear(start: number = 0, end?: number) {
        const e = end ?? this.lines;
        this.lines = start;

        for (let i = start; i < e; i++)
        {
            process.stdout.write('\x1b[2K'); // clear entire line
            process.stdout.write('\x1b[1A'); // move cursor up one line
        }

        process.stdout.write('\x1b[2K');
        process.stdout.write('\r');
    }

    static async surpress<T = any>(callback: () => Promise<T>): Promise<T> {
        const originalWrite = process.stdout.write;
        process.stdout.write = () => true; // swallow all stdout

        let ans: T;
        try
        {
            ans = await callback();
        }
        finally
        {
            process.stdout.write = originalWrite;
            return ans!;
        }
    }

    static async sessionBlock<T = any>(callback: (session: number) => Promise<T>): Promise<T> {
        const previousSession = this.session;
        const session = this.createSession();
        const ans = await callback(session);
        this.clearSession();
        this.session = previousSession;

        return ans;
    }

    static createSession() {
        this.session = this.lines;

        return this.session;
    }

    static closeSession() {
        this.session = null;
    }

    static clearSession(session?: number) {
        const index = session ?? this.session;
        if (index === null) return;

        this.clear(index);
        this.closeSession();

        this.createSession();
    }

    static prompt(promptText: string, inline?: boolean, cwd?: string) {
        return prompt(Terminal, promptText, inline, cwd);
    }

    static async option(options: string[] | string[][], promptText = "↑↓ select • Enter confirm", currentMarker = "●", defaultMarker = "◯") {
        return this.sessionBlock(async () => await option(Terminal, options, promptText, currentMarker, defaultMarker));
    }

    static async confirm(question: string, defaultValue = false) {
        const options = defaultValue ? ["yes", "no"] : ["no", "yes"];

        const answer = await this.option(options, question);

        return defaultValue ? answer.index === 0 : answer.index === 1;
    }

    static execute(command: string, cwd: string): Promise<void>;
    static execute(command: string, cwd: string, args: string[]): Promise<void>;
    static execute(command: string, options: Partial<SpawnOptions>): Promise<void>;
    static execute(command: string, something: Partial<SpawnOptions> | string, args?: string[]) {

        let options: Partial<SpawnOptions> = {};
        if (typeof something === "string")
        {
            options.cwd = something;
            if (args) options.args = args;
        }
        else 
        {
            options = something;
        }

        return new Promise<void>((res, rej) => {
            this.spawn(command, {
                ...options,
                onClose(code, stdout, stderr) {
                    if (code === 0)
                    {
                        options.onClose?.(0, stdout, stderr);
                        return res();
                    }

                    rej(new Error(stderr || stdout || `Process exited with code ${code}`));
                },
                onError(error, stdout, stderr) {
                    rej({ error, stdout, stderr });
                },
            });
        });
    }

    static spawn(command: string, options: Partial<SpawnOptions>) {
        const [cmd, ..._args] = command.split(" ");

        let stdout = "";
        let stderr = "";

        const child = spawn(cmd, _args.concat(options.args ?? []), {
            cwd: options.cwd,
            stdio: "pipe",
            shell: false,
            env: { ...process.env },
        });

        child.stdout.on("data", chunk => {
            const text = chunk.toString("utf8");
            stdout += text;
            options.onData?.(text);
        });

        child.stderr.on("data", chunk => {
            const text = chunk.toString("utf8");
            stderr += text;
        });

        child.on("error", error => options.onError?.(error, stdout, stderr));
        child.on("close", code => options.onClose?.(code, stdout, stderr));

        return child;
    }
}