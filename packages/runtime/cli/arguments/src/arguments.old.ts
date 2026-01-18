/**
 * Parses command-line arguments from `process.argv` into flags and positional values.
 *
 * Supports:
 * - Long flags: `--name` or `--name=value`
 * - Short flags: `-n` or `-n value`
 * - Grouped short flags: `-abc` → `{ a, b, c }` all true
 *
 * Flags listed in `islands` will not consume the next argument as their value.
 *
 * @param {string[]} [islands=[]] - Flag names that should not consume the next argument.
 * @returns {{ flags: Record<string, string | true | undefined>, values: string[] }}
 *
 * @example
 * // process.argv = ["node", "script.js", "--foo=bar", "-abc", "positional", "--baz", "qux"]
 * ExtractArguments(["baz"]);
 * // => {
 * //    flags: { foo: "bar", a: true, b: true, c: true, baz: true },
 * //    values: ["positional", "qux"]
 * // }
 */

type ArgumentsType = { flags: Record<string, string | string[] | true | undefined>, values: string[] };
// export function getArguments(islands: string[] = [], args = process.argv) {
//     return extractArguments(args, islands);
// }

// export function extractArguments(values: string[], islands: string[]) {
//     const _arguments: ArgumentsType = {
//         flags: {},
//         values: [],
//     };
//     let prevWasFlag = null;
//     for (let i = 2; i < values.length; i++)
//     {
//         const arg = values[i];
//         let match = arg.match(/^(?<flag>--?)(?<name>[^=]+)(=(?<value>.*))?$/);
//         if (!match)
//         {
//             if (prevWasFlag) 
//             {
//                 _arguments.flags[prevWasFlag] = arg;
//             }
//             else 
//             {
//                 _arguments.values.push(arg);
//             }

//             prevWasFlag = null;
//             continue;
//         }

//         const { value, name } = match.groups ?? {};

//         if (match.groups?.flag == "-" && value)
//         {
//             // we treat as multiple groups 
//             for (let j = 0; j < name.length; j++)
//             {
//                 const group = name[j];
//                 if (!_arguments.flags[group]) _arguments.flags[group] = true;
//             }
//             continue;
//         }

//         if (!islands.includes(name))
//         {
//             prevWasFlag = name;
//         }

//         if (!_arguments.flags[name]) _arguments.flags[name] = value ?? true;
//         else 
//         {
//             if (_arguments.flags[name] === true) _arguments.flags[name] = value ?? true;
//             else 
//             {
//                 if (typeof _arguments.flags[name] === "string") _arguments.flags[name] = [_arguments.flags[name], value]
//                 else
//                 {
//                     _arguments.flags[name].push(value);
//                 }
//             }
//         }
//     }

//     return _arguments;
// }

type Loglevel = "verbose" | "debug" | "info" | "error" | "warning" | "silent";
export class Arguments {
    private static _islands: string[] = ["verbose", "debug", "warning", "error", "info"];
    static get islands() {
        return this._islands;
    }
    static set islands(value: string[]) {
        this._islands = value.concat("verbose", "debug", "warning", "error", "info");
        this._args = undefined;
    }

    private static _args: ArgumentsType | undefined;
    static get args(values: string[] = process.argv): ArgumentsType {
        if (this._args) return this._args;
        this._args = this.extract(this.islands, values);
        return this._args;
    }

    private static _debug: boolean | undefined;
    private static _verbose: boolean | undefined;
    private static _warning: boolean | undefined;
    private static _error: boolean | undefined;
    private static _info: boolean | undefined;
    private static _silent: boolean | undefined;

    static get(name: string) {
        const value = this.args.flags[name];
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value;

        return [];
    }

    static string(name: string) {
        return this.get(name).at(0);
    }

    static number(name: string, fallback?: number) {
        const value = Number(this.string(name));
        if (Number.isNaN(value)) return fallback ?? value;
        return value;
    }

    static has(name: string) {
        return !!this.args.flags[name]
    }

    static get silent() {
        return this.getLoglevel("silent");
    }
    static get debug() {
        return this._silent ? false : this.getLoglevel("debug");
    }
    static get verbose() {
        return this._silent ? false : this.getLoglevel("verbose", ["debug"]);
    }
    static get info() {
        return this._silent ? false : this.getLoglevel("info", ["debug", "verbose"]);
    }
    static get warning() {
        return this._silent ? false : this.getLoglevel("warning", ["debug", "verbose", "info"]);
    }
    static get error() {
        return this._silent ? false : this.getLoglevel("error", ["debug", "verbose", "info", "warning"]);
    }

    private static getLoglevel(name: Loglevel, others: Loglevel[] = []) {
        const privateName = `_${name}` as const;
        if (typeof this[privateName] === "boolean") return this[privateName];
        this[privateName] = !!this.args.flags[name];
        if (!this[privateName])
        {
            this[privateName] = others.some(level => this[level]);
        }
        return this[privateName];
    }

    static extract(values: string[], islands: string[]) {
        const _arguments: ArgumentsType = {
            flags: {},
            values: [],
        };
        let prevWasFlag = null;
        for (let i = 2; i < values.length; i++)
        {
            const arg = values[i];
            let match = arg.match(/^(?<flag>--?)(?<name>[^=]+)(=(?<value>.*))?$/);
            if (!match)
            {
                if (prevWasFlag) 
                {
                    _arguments.flags[prevWasFlag] = arg;
                }
                else 
                {
                    _arguments.values.push(arg);
                }

                prevWasFlag = null;
                continue;
            }

            const { value, name } = match.groups ?? {};

            if (match.groups?.flag == "-" && value)
            {
                // we treat as multiple groups 
                for (let j = 0; j < name.length; j++)
                {
                    const group = name[j];
                    if (!_arguments.flags[group]) _arguments.flags[group] = true;
                }
                continue;
            }

            if (!islands.includes(name))
            {
                prevWasFlag = name;
            }

            if (!_arguments.flags[name]) _arguments.flags[name] = value ?? true;
            else 
            {
                if (_arguments.flags[name] === true) _arguments.flags[name] = value ?? true;
                else 
                {
                    if (typeof _arguments.flags[name] === "string") _arguments.flags[name] = [_arguments.flags[name], value]
                    else
                    {
                        _arguments.flags[name].push(value);
                    }
                }
            }
        }

        return _arguments;
    }
}