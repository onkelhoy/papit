import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';

// Resolve the directory name and base path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function () {
  fs.rmSync(path.join(__dirname, ".temp"), { recursive: true, force: true });
}