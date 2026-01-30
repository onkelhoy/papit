import { spawn } from "node:child_process";

export function spawnCommand(command, cwd, args = []) {
    const [cmd, ..._args] = command.split(" ");

    return new Promise((resolve, reject) => {

        const child = spawn(cmd, _args.concat(args), {
            cwd,
            stdio: process.env.CI ? "inherit" : "pipe",
            shell: process.env.CI ? false : true,
            env: { ...process.env },
        });

        if (child.stdout) 
        {
            child.stdout.on("data", data => {
                // process.stdout.write(data);
            });
        }
        if (child.stderr)
        {
            child.stderr.on("data", data => {
                process.stderr.write(data);
            });
        }

        child.on("close", code => {
            if (code === 0) resolve();
            else 
            {
                reject(new Error("code: " + code));
            }
        });
    });
}