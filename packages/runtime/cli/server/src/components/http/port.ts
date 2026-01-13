import { Terminal } from "@papit/terminal";
import net from "node:net";

function isPortFree(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise(resolve => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port, host);
  });
}

export async function getPort(
  start: number,
  maxAttempts = 20
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++)
  {
    const port = start + i;
    if (await isPortFree(port)) return port;
  }

  Terminal.error(`No free ports found in range [${start}, ${start + maxAttempts}]`);
  process.exit(1);
}
