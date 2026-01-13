import { Arguments, getPathInfo, LocalPackage, Terminal } from "@papit/util";

export default async function tester(info: ReturnType<typeof getPathInfo>, packageJSON: LocalPackage) {
  if (Arguments.info) Terminal.write(Terminal.blue(packageJSON.name), "testing", Terminal.yellow("node"));

  
}