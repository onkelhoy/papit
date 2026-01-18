import readline from "node:readline";
import { type Terminal } from "../terminal";

export async function option(
  instance: typeof Terminal, 
  options: string[] | string[][], 
  promptText = "↑↓ select • Enter confirm", 
  currentMarker = "●", 
  defaultMarker = "◯"
) {
    return new Promise<{ index: number, text: string }>(resolve => {
      // Ensure stdin is resumed and ready
      if (process.stdin.isPaused()) {
        process.stdin.resume();
      }
      readline.emitKeypressEvents(process.stdin);
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      const cleanup = () => {
        process.stdin.removeListener("keypress", handleKeydown);
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
      };

      const _options = options.flat();
      const spaces = new Set<number>();
      if (Array.isArray(options[0]))
      {
        for (let i = 0; i < options.length - 1; i++)
        {
          spaces.add(options[i].length);
        }
      }

      instance.write(promptText);
      instance.createSession();

      const printoptions = (clear = true) => {
        if (clear) instance.clearSession();

        for (let i = 0; i < _options.length; i++)
        {
          if (spaces.has(i)) 
          {
            instance.write();
          }

          const prefix = i === index ? currentMarker : defaultMarker;
          instance.write(`${prefix} ${_options[i]}`);
        }
      }

      let index = 0;
      printoptions(false);

      function handleKeydown(str: string, key: any) {
        const enter = /return/i.test(key.name) || /space/i.test(key.name);

        if (key.ctrl && key.name === "c" || str === "\x04" || key.ctrl && key.name === "d" || enter)
        {
          cleanup();

          if (enter)
          {
            resolve({index, text: _options[index]});
            return;
          }

          instance.error("\ncancelled");
          process.exit();
        }

        if (/up/i.test(key.name) || key.shift && /tab/i.test(key.name))
        {
          index--;
          if (index < 0) index = _options.length - 1;
          printoptions();
        }
        else if (/down/i.test(key.name) || /tab/i.test(key.name))
        {
          index++;
          if (index >= _options.length) index = 0;
          printoptions();
        }
      };

      process.stdin.on("keypress", handleKeydown);
    });
  }