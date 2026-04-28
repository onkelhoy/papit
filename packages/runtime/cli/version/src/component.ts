// import statements 
import { pre } from "./components/pre";
import { post } from "./components/post";
import { Terminal } from "@papit/terminal";
import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";
import { reset } from "components/reset";
import { remote } from "components/remote";

(async function () {

    if (Arguments.has("reset"))
    {
        // we reset to remoteVersion and 0.0.1 if none existing 
        return reset();
    }

    // would like to call it "remote" but I fear it might collide 
    if (Arguments.has("sync"))
    {
        // we sync the remoteVersion to whats on the remote 
        return remote();
    }

    if (!Information.package.packageJSON)
    {
        Terminal.error("package.json missing");
        throw new Error("package.json missing");
    }

    if (Arguments.has("pre") || process.env.npm_lifecycle_event === "preversion")
    {
        return pre();
    }

    if (Arguments.has("post") || process.env.npm_lifecycle_event === "postversion")
    {
        post(Information.package.packageJSON);
    }
}());