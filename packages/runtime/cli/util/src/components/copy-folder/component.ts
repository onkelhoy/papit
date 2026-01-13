import fs from "node:fs/promises";
import path from "node:path";

/**
 * Recursively copy a folder to a destination.
 * Optionally, post-process files with a parser function.
 *
 * @param {string} src - Source folder path
 * @param {string} dest - Destination folder path
 * @param {(content: string, src: string, destination: string) => false | string | Promise<string|false>} [parser] - Optional function to transform file content, use false to filter out
 */
export async function copyFolder(src:string, dest: string, parser: (content: string, src: string, destination: string) => false | string | Promise<string|false>) {
  // Ensure destination exists
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFolder(srcPath, destPath, parser); // recursive copy
      continue;
    } 
    
    // case file 
    if (typeof parser !== "function") {
      await fs.copyFile(srcPath, destPath);
      continue;
    }

    const content = await fs.readFile(srcPath, "utf-8");
    const parsed = await parser(content, srcPath, destPath);
    if (parsed === false) continue;
    
    await fs.copyFile(srcPath, destPath);
    await fs.writeFile(destPath, parsed, "utf-8");
  }
}
