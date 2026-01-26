import { Information } from "@papit/information";
import { Args } from "@papit/arguments";
import { LoadingClose, Terminal } from "@papit/terminal";

export async function npmInstall(args: Args, canPrint: boolean) {

    if (args.has("ci") || args.has('no-install')) return;

    let close: LoadingClose | undefined;
    if (canPrint) 
    {
        const loadingInfo = Terminal.loading("installing packages");
        close = loadingInfo.close;
    }
    await Terminal.execute("npm install", Information.root.location);
    if (close) close();
}