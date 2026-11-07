// npm run showcase [-- flags]: generates the showcase and publishes it as a static site in ./showcase
// generate flags (--type, --include, --no-analyse, ...) go to @papit/create, --base goes to @papit/static
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const SOURCE = ".temp/showcase";
const OUTPUT = "showcase";

const args = process.argv.slice(2);
const base = args.find(arg => arg.startsWith("--base"));
const generate = args.filter(arg => arg !== base);

function run(command) {
    const result = spawnSync(command, { stdio: "inherit", shell: true });
    if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["npm create @papit -- --showcase", `--output=${SOURCE}`, ...generate].join(" "));

fs.rmSync(OUTPUT, { recursive: true, force: true });
run(["npx @papit/static", `--target=${SOURCE}`, `--output=${OUTPUT}`, base ?? "", "--skip-errors --info"].join(" "));

console.log(`\nshowcase ready: cd ${OUTPUT} && python3 -m http.server 8000`);
