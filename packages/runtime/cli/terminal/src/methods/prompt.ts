// import statements 
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";

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
let tabbing = false;

export async function prompt(
    instance: typeof Terminal,
    promptText: string,
    inline?: boolean,
    cwd?: string,
) {
    input = "";
    cursor = 0;
    suggestions = [];
    tabbing = false;

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    if (process.stdin.isPaused()) process.stdin.resume();


    // Write prompt text first
    let starttext: string;
    if (inline) starttext = promptText + ": ";
    else
    {
        starttext = "> ";
        process.stdout.write(promptText + "\n");
    }
    process.stdout.write(starttext);

    // Reserve suggestion row BEFORE writing starttext
    process.stdout.write("\n\x1b[1A");

    process.stdout.write(starttext);
    const anchorPos = await getCursorPos();
    // NOW hand over to readline
    readline.emitKeypressEvents(process.stdin);

    return new Promise<Output>((resolve) => {
        const startSession = instance.createSession();

        const cleanup = () => {
            suggestions = [];
            redraw();
            process.stdout.removeListener("resize", redraw);
            process.stdin.removeListener("keypress", handleKeydown);
            if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
        };

        const redraw = () => {
            process.stdout.write(`\x1b[${anchorPos.row};1H`); // col 1, not anchorPos.col
            process.stdout.write("\x1b[J");
            process.stdout.write(starttext); // always rewrite "> " or "name: "
            drawInput();
            drawSuggestions();
            restoreCursor();
        };

        const drawInput = () => {

            // Redraw content
            process.stdout.write(input);
        }

        const drawSuggestions = () => {
            if (suggestions.length < 2) return;
            process.stdout.write("\r\n");
            suggestions.forEach(suggestion => {
                process.stdout.write(instance.dim(suggestion.name) + "\t");
            });
            // restoreCursor jumps back absolutely — no need to move up
        };

        const restoreCursor = () => {
            const cols = process.stdout.columns ?? 80;
            const absolute = (anchorPos.col - 1) + cursor; // col is 1-based
            const rowOffset = Math.floor(absolute / cols);
            const colOffset = (absolute % cols) + 1;

            process.stdout.write(`\x1b[${anchorPos.row + rowOffset};${colOffset}H`);
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

                if (tabbing)
                {
                    // confirm selection, clear suggestions
                    tabbing = false;
                    suggestions = [];
                    suggestion_index = 0;
                }
                else if (cursor < input.length) cursor++;
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
                // if (cursor > 0)
                // {
                //     input = input.slice(0, cursor - 1) + input.slice(cursor);
                //     cursor--;
                // }

                if (cursor > 0)
                {
                    input = input.slice(0, cursor - 1) + input.slice(cursor);
                    cursor--;
                    tabbing = false;
                    suggestions = [];
                    suggestion_index = 0;
                }
            }
            else if (/tab/i.test(key.name))
            {
                handleTab(cwd);
            }
            else if (!key.meta && !key.ctrl && (str || str === " "))
            {
                // any character typed cancels tab cycling
                tabbing = false;
                suggestions = [];
                suggestion_index = 0;
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
// let tab_timestamp = performance.now();
let base_path = ""; // Track the directory we're completing in

const normalizeInputPath = (input: string, cwd?: string): string => {
    if (input.startsWith("~")) return input.replace(/^\~/, os.homedir());
    if (!/^[\.|\/]/.test(input)) return path.join(cwd ?? process.cwd(), input);
    return input;
};

function getCursorPos(): Promise<{ row: number; col: number }> {
    return new Promise((resolve) => {
        const onData = (data: Buffer) => {
            const match = data.toString().match(/\[(\d+);(\d+)R/);
            if (match)
            {
                process.stdin.removeListener("data", onData);
                resolve({ row: parseInt(match[1]), col: parseInt(match[2]) });
            }
        };
        process.stdin.on("data", onData);
        process.stdout.write("\x1b[6n");
    });
}

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
    if (suggestions.length === 0)
    {
        getSuggestions(cwd);
        tabbing = suggestions.length > 0;
        return;
    }

    suggestion_index = (suggestion_index + 1) % suggestions.length;
    input = base_path + suggestions[suggestion_index].name;
    cursor = input.length;
    tabbing = true;
}