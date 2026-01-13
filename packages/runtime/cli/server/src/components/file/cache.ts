import fs from "node:fs";
import { FileConstants } from "./types";
import { getURL } from "../http/url";
import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

// Cache configuration
type CacheEntry = {
  buffer: Buffer;
  mimeType: string;
  mtime: number | null; // Modified time for cache invalidation
}

export class Cache {
  private readonly map = new Map<string, CacheEntry>();
  private _size = 0;

  name = "cache";
  constructor(name?: string) {
    if (name) this.name = name;
  }

  get size() { return this._size }

  private _maxSize = FileConstants.MAX_FILE_SIZE_TO_CACHE;
  get maxSize() { return this._maxSize }
  set maxSize(value: number) { this._maxSize = value * 1024 * 1024 } // in MB

  get(url: ReturnType<typeof getURL>) {
    const cached = this.map.get(url.absolute);
    if (!cached) return null;

    if (cached.mtime === null) return cached;

    const stats = fs.statSync(url.absolute);
    if (stats.mtimeMs === cached.mtime) return cached;

    this.delete(url);
    return null;
  }

  delete(url: ReturnType<typeof getURL>, noprint = false) {
    const cached = this.map.get(url.absolute);
    if (cached)
    {
      if (Arguments.info && !noprint) Terminal.write(Terminal.yellow(url.relative), "removed from cache:" + Terminal.blue(this.name))
      this._size -= cached.buffer.length;
      this.map.delete(url.absolute);
    }
  }

  clear() {
    this.map.clear();
    this._size = 0;
  }

  add(url: ReturnType<typeof getURL>, buffer: Buffer, mimeType?: string, mtime?: number | null) {
    if (Arguments.has("no-cache")) return;
    this.delete(url, true); // making sure to clean 
    this._size += buffer.length;

    if (Arguments.info) Terminal.write(Terminal.yellow(url.relative), "added to cache:" + Terminal.blue(this.name))
    this.map.set(url.absolute, {
      mimeType: mimeType ?? FileConstants.MimeTypes[url.absolute] ?? "text/plain",
      buffer,
      mtime: mtime === undefined ? fs.statSync(url.absolute).mtimeMs : mtime,
    });
  }

  isCacheable(size: number, ext: string): boolean {
    // Don't cache large files or video files
    if (size > this.maxSize) return false;
    if (['.mp4', '.webm', '.ogv', '.avi', '.mov'].includes(ext)) return false;
    return true;
  }
}