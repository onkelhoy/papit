import { Arguments } from "../arguments";
import fs from "node:fs";

/**
 * Load a JSON file from the given filepath.
 *
 * @param {string} filepath - Path to the JSON file.
 * @returns {any|null} Parsed JSON content, or `null` if the file does not exist.
 */
export function getJSON<T extends object>(filepath: string): T | null {
  try
  {
    const content = fs.readFileSync(filepath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err)
  {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    )
    {
      // File does not exist
      if (Arguments.debug) console.warn(`File not found: ${filepath}`);
      return null;
    }
    // Other errors (e.g., invalid JSON) should still be thrown
    throw err;
  }
}
