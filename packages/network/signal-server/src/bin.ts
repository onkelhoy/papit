import { Arguments } from "@papit/arguments";
import { Terminal } from "@papit/terminal";

import { generateVapidKeys } from "./push/vapid";
import { start } from "./server";

(function () {
    if (Arguments.has("generate-vapid"))
    {
        const { publicKey, privateKey } = generateVapidKeys();
        Terminal.write(`VAPID_PUBLIC_KEY=${publicKey}`);
        Terminal.write(`VAPID_PRIVATE_KEY=${privateKey}`);
        return;
    }

    start();
}());
