import path from "node:path";
import fs from "node:fs";
import { Information } from "@papit/information";

export async function pre() {
    const PKG_LOCK = path.join(Information.root.location, "package-lock.json"); // trick to not case npm to spat out npm installs 
    if (!fs.existsSync(PKG_LOCK)) return;

    fs.renameSync(PKG_LOCK, path.join(Information.root.location, "temp-package-lock.json"));
}