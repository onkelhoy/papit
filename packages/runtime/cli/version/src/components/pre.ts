import path from "node:path";
import fs from "node:fs";
import { getPathInfo, LocalPackage } from "@papit/util";

export async function pre(packageJSON: LocalPackage, originalinfo: ReturnType<typeof getPathInfo>) {
  const PKG_LOCK = path.join(originalinfo.root, "package-lock.json");
  if (!fs.existsSync(PKG_LOCK)) return;

  fs.renameSync(PKG_LOCK, path.join(originalinfo.root, "temp-package-lock.json"));
}