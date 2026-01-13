import fs from "node:fs";
import path from "node:path";
import { spawnCommand } from "./spawn-command.mjs";

(async function () {

  const folders = fs.globSync("packages/**/package.json", {
    cwd: process.cwd(),
    absolute: true,
    ignore: [
      "packages/**/asset/**", // unforthunally does not work
    ],
  });

  let finds = 0; // if the ignore was to work we could avoid doing like this
  for (const dir of folders)
  {
    if (/packages.*\/asset.*/.test(dir)) continue;
    finds++;

    const dirname = path.dirname(dir);
    fs.rmSync(path.join(dirname, ".temp"), { recursive: true, force: true });
    fs.rmSync(path.join(dirname, "lib"), { recursive: true, force: true });
  }

  if (finds > 0)
    await spawnCommand("npm install", process.cwd());
}())