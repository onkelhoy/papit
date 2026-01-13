// import statements 
import path from "node:path";
import { Arguments, getJSON, getPathInfo, LocalPackage, Terminal } from "@papit/util";
import { pre } from "./components/pre";
import { post } from "./components/post";

(async function () {
  const location = Arguments.args.flags.location;
  const originalinfo = getPathInfo(typeof location === "string" ? location : undefined);

  const packageJSON = getJSON<LocalPackage>(path.join(originalinfo.local, "package.json"));
  if (!packageJSON)
  {
    Terminal.error("package.json missing");
    throw new Error("package.json missing");
  }

  if (Arguments.args.flags.pre || process.env.npm_lifecycle_event === "preversion")
  {
    pre(packageJSON, originalinfo);
    return;
  }

  if (Arguments.args.flags.post || process.env.npm_lifecycle_event === "postversion")
  {
    post(packageJSON, originalinfo);
  }
}());