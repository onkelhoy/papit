// import statements 
import { pre } from "./components/pre";
import { post } from "./components/post";
import { Terminal } from "@papit/terminal";
import { Arguments } from "@papit/arguments";
import { Information } from "@papit/information";

(async function () {
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