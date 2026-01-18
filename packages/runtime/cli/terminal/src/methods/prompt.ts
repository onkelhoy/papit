// import statements 
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { type Terminal } from "../terminal";

class Output {
  public path: string;
  constructor(
    public input: string,
  ) {
    this.path = normalizeInputPath(input);
  }

  toString() {
    return this.input;
  }

  [Symbol.toPrimitive]() {
    return this.toString();
  }
}

let input = "";
let cursor = 0;
let suggestions: Array<{ name: string, location: string }> = [];

export async function prompt(
  instance: typeof Terminal,
  promptText: string,
  inline?: boolean,
  cwd?: string,
) {
  input = "";
  cursor = 0;
  suggestions = [];

  return new Promise<Output>((resolve) => {

    const startSession = instance.createSession();

    if (process.stdin.isPaused()) process.stdin.resume();

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    // Print prompt once
    let starttext: string;
    if (inline) starttext = promptText + ": ";
    else 
    {
      starttext = "> ";
      process.stdout.write(promptText + "\n");
    }
    process.stdout.write(starttext);

    // 🔒 Save cursor position (ANCHOR)
    process.stdout.write("\x1b[s");
    // let tab_timestamp = performance.now();

    const cleanup = () => {
      suggestions = [];
      redraw();
      process.stdout.removeListener("resize", redraw);
      process.stdin.removeListener("keypress", handleKeydown);
      if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
    };

    const drawInput = () => {

      // Redraw content
      process.stdout.write(input);
    }

    const drawSuggestions = () => {
      if (suggestions.length < 2) return;
      const cols = process.stdout.columns ?? 80;

      process.stdout.write("\n");
      let length = 0;
      suggestions.forEach(suggestion => {
        length += suggestion.name.length;
        length += 8 - (length % 8) // tab
        process.stdout.write(instance.dim(suggestion.name) + "\t");
      });

      const rows = Math.max(1, Math.ceil(length / cols));
      for (let i = 0; i < rows; i++)
      {
        process.stdout.write("\x1b[1A"); // move one line up 
      }
    }

    const restoreCursor = () => {
      const cols = process.stdout.columns ?? 80;
      const absolute = starttext.length + cursor;

      // If absolute is divisible by cols, the cursor is visually on the next row
      const atWrap = absolute > 0 && absolute % cols === 0;

      const rowOffset = Math.floor(absolute / cols) - (atWrap ? 1 : 0);
      const colOffset = (absolute % cols) + 1;

      // Move down only if rowOffset > 0
      if (rowOffset > 0)
      {
        // process.stdout.write(`\x1b[${rowOffset}B`);
      }

      // Move to correct column
      process.stdout.write(`\x1b[${colOffset}G`);

      // If exactly at wrap, move down one more
      if (atWrap)
      {
        process.stdout.write(`\x1b[1B`);
      }
    };

    const redraw = () => {
      process.stdout.write("\x1b[u"); // go to anchor
      process.stdout.write("\x1b[J"); // clear down

      drawInput();
      drawSuggestions();

      restoreCursor();
    };

    const word_minus = () => {
      // move to spaces 
      let moved: number | undefined;
      for (let i = cursor - 1; i >= 0; i--)
      {
        if (/\s/.test(input[i])) 
        {
          moved = i;
        }
        else if (moved !== undefined)
        {
          break;
        }
      }

      cursor = moved ?? 0;
    }

    const handleKeydown = (str: string, key: any) => {
      const enter = key.name === "return";

      if (
        (key.ctrl && key.name === "c") ||
        str === "\x04" ||
        (key.ctrl && key.name === "d")
      )
      {
        cleanup();
        instance.error("\ncancelled");
        process.exit();
      }

      if (enter)
      {
        cleanup();
        process.stdout.write("\n");
        resolve(new Output(input));
        return;
      }

      if (key.sequence === "\x1bb") // option + left (move words)
      {
        word_minus();
      }
      else if (key.sequence === "\x1bf") // option + right (move words)
      {
        // move to spaces 
        let moved: number | undefined;
        for (let i = cursor + 1; i < input.length; i++)
        {
          if (/\s/.test(input[i])) 
          {
            moved = i;
          }
          else if (moved !== undefined)
          {
            moved = i;
            break;
          }
        }

        cursor = moved ?? input.length;
      }
      else if (/left/i.test(key.name))
      {
        if (cursor > 0) cursor--;
      }
      else if (/right/i.test(key.name)) 
      {
        if (cursor < input.length) cursor++;
      }
      else if (/home/i.test(key.name)) 
      {
        cursor = 0;
      }
      else if (/end/i.test(key.name)) 
      {
        cursor = input.length;
      }
      else if (key.name === "w" && key.ctrl === true) // option + backspace 
      {
        word_minus();
        input = input.slice(0, cursor);
      }
      else if (/backspace/i.test(key.name)) 
      {
        if (cursor > 0)
        {
          input = input.slice(0, cursor - 1) + input.slice(cursor);
          cursor--;
        }
      }
      else if (/tab/i.test(key.name))
      {
        handleTab(cwd);
      }
      else if (!key.meta && !key.ctrl && (str || str === " "))
      {
        input = input.slice(0, cursor) + str + input.slice(cursor);
        cursor++;
      }
      redraw();
    };

    process.stdout.on("resize", redraw);
    process.stdin.on("keypress", handleKeydown);
  });
}
// dealing with tabbing

let suggestion_index = 0;
let tab_timestamp = performance.now();
let base_path = ""; // Track the directory we're completing in

const normalizeInputPath = (input: string, cwd?: string): string => {
  if (input.startsWith("~")) return input.replace(/^\~/, os.homedir());
  if (!/^[\.|\/]/.test(input)) return path.join(cwd ?? process.cwd(), input);
  return input;
};

function getSuggestions(cwd?: string) {
  const currentpath = normalizeInputPath(input, cwd);
  suggestion_index = 0;

  // Determine the base directory to search
  let searchDir: string;
  if (fs.existsSync(currentpath) && fs.statSync(currentpath).isDirectory())
  {
    // Input is a directory, search inside it
    searchDir = currentpath;
    // If input is empty, base_path should be empty (current directory)
    base_path = input === "" ? "" : (input.endsWith("/") ? input : input + "/");
  } else
  {
    // Input is partial, search in parent directory
    searchDir = path.dirname(currentpath);

    // Extract the directory part from the original input string
    const lastSlash = input.lastIndexOf("/");
    base_path = lastSlash >= 0 ? input.slice(0, lastSlash + 1) : "";
  }

  if (!fs.existsSync(searchDir))
  {
    suggestions = [];
    return;
  }

  const basename = path.basename(input);
  const dirs = fs.readdirSync(searchDir);

  suggestions = dirs
    .map(name => {
      try
      {
        const location = path.join(searchDir, name);
        const stat = fs.statSync(location);

        if (name.startsWith(".")) return null;

        // Filter by basename if we're completing a partial name
        if (basename && searchDir !== currentpath && !name.startsWith(basename))
        {
          return null;
        }

        const displayName = stat.isDirectory()
          ? (name.endsWith("/") ? name : name + "/")
          : name;

        return { name: displayName, location };
      } catch
      {
        return null;
      }
    })
    .filter(v => v !== null);
};

function handleTab(cwd?: string) {
  const now = performance.now();
  const isRecentTab = now - tab_timestamp < 1500;
  const basename = path.basename(input);

  if (suggestions.length === 1)
  {
    const s = suggestions.at(0);
    if (s?.name.startsWith(basename))
    {
      input = base_path + s.name;
      suggestions = [];
      suggestion_index = 0;
      cursor = input.length;
    }
  }

  // First tab or no suggestions - get them
  if (suggestions.length === 0)
  {
    tab_timestamp = now;
    getSuggestions(cwd);
    return;
  }

  // Recent tab - cycle through current suggestions
  if (isRecentTab)
  {
    suggestion_index = (suggestion_index + 1) % suggestions.length;
    const selected = suggestions[suggestion_index];
    input = base_path + selected.name;
    cursor = input.length;
    tab_timestamp = now;
    return;
  }

  // Stale tab - check if we need to drill down or refresh
  tab_timestamp = now;
  const currentpath = normalizeInputPath(input);

  // If input is now a directory, drill into it
  if (fs.existsSync(currentpath) && fs.statSync(currentpath).isDirectory())
  {
    getSuggestions(cwd);
    return;
  }

  // Otherwise, filter current suggestions by new input
  const filtered = suggestions.filter(s => s.name.startsWith(basename));

  if (filtered.length > 0)
  {
    suggestions = filtered.sort((a, b) => a.name.length - b.name.length);
    suggestion_index = 0;
  } else
  {
    // No matches, refresh suggestions
    getSuggestions(cwd);
  }
};