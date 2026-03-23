import { spawn } from "node:child_process";

export function spawnCommand(command, cwd, args = []) {
    const [cmd, ..._args] = command.split(" ");

    return new Promise((resolve, reject) => {
        const full = [cmd, ..._args.concat(args)].join(" ");

        const child = spawn(full, {
            cwd,
            stdio: "pipe",
            shell: true,
            env: { ...process.env },
        });

        child.stdout.on("data", data => {
            // process.stdout.write(data);
        });
        child.stderr.on("data", data => {
            process.stderr.write(data);
        });

        child.on("close", code => {
            if (code === 0) resolve();
            else 
            {
                reject(new Error("code: " + code));
            }
        });
    });
}