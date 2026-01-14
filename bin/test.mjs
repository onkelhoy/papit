import { Terminal } from "@papit/util";
import { Arguments, getDependencyOrder } from "@papit/util";

(async function () {
    getDependencyOrder(async batch => {
        const promises = [];
        for (const b of batch)
        {
            promises.push(Terminal.spawn("npm test", {
                cwd: b.location,
                args: process.argv.slice(2),
            }));
        }

    });
}())