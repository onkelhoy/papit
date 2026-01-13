import path from "node:path";
import { Arguments, getJSON, getPathInfo, LocalPackage, Terminal } from "@papit/util";
// import node from "./node";
// import browser from "./browser";

(async function () {
  const info = getPathInfo(undefined, import.meta.url);
  const packageJSON = getJSON<LocalPackage>(path.join(info.package, "package.json"));

  if (!packageJSON)
  {
    Terminal.error("package.json not found");
    process.exit(1);
  }

  if (!packageJSON?.papit)
  {
    Terminal.error("package.json is missing", Terminal.blue("papit"), "property");
    process.exit(1);
  }

  // if (packageJSON.papit.type === "node")
  // {
  //   node(info, packageJSON);
  // }
  // else 
  // {
  //   browser(info, packageJSON);
  // }
}());
