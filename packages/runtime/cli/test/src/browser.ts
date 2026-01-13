// import { runCLI } from '@playwright/test/cli';

import { Arguments, getPathInfo, LocalPackage, Terminal } from "@papit/util";
import path from "node:path";

export default async function tester(info: ReturnType<typeof getPathInfo>, packageJSON: LocalPackage) {
  if (Arguments.info) Terminal.write(Terminal.blue(packageJSON.name), "testing", Terminal.yellow("browser"));

  return Terminal.spawn("npx playwright test -c", {
    args: [path.join(info.script!, "playwright-config.js")]
  })
}