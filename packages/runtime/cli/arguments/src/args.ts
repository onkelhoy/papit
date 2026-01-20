import { Loglevel } from "./loglevel";

type Primitive = string | number | boolean;
type Input = Primitive | Primitive[];
export class Instance {
    flags: Record<string, string[]> = {};
    values: string[] = [];

    private convert(value: Input): string[] {
        if (Array.isArray(value)) return value.map(String);
        if (value === true) return [];
        return [String(value)];
    }

    toggle(key: string) { this.set(key, !this.has(key)) }
    get(key: string) { return this.flags[key] }
    set(key: string, value: Input) {
        this.flags[key] = this.convert(value)
    }
    add(key: string, value: Input) {
        this.flags[key] = [...(this.flags[key] ?? []), ...this.convert(value)];
    }
    has(key: string) { return !!this.get(key) }
    string(key: string) {
        const value = this.get(key);
        return value.at(0);
    }
    number(key: string) {
        const value = this.string(key);
        return Number(value);
    }

    constructor(input: Input, islands: string[] = []) {
        const converted = this.convert(input);

        let flagName: string | null = null;
        converted.forEach(arg => {
            const match = arg.match(/^(?<flag>--?)(?<name>[^=]+)(=(?<value>.*))?$/);

            if (!match)
            {
                if (flagName) this.set(flagName, arg);
                else this.values.push(arg);

                flagName = null;
                return;
            }

            const { value, name } = match.groups ?? {};

            if (match.groups?.flag == "-" && value)
            {
                // we treat as multiple groups 
                for (let j = 0; j < name.length; j++)
                {
                    this.toggle(name[j]);
                }
                return;
            }

            if (!islands.includes(name))
            {
                flagName = name;
            }

            this.add(name, value);
        });
    }
}

export class Arguments {
    private static instance: Instance;
    static init(input: Input, islands: string[] = []) {
        if (!this.instance) this.instance = new Instance(input, islands);
        if (this.instance.has("debug")) Loglevel.level = "debug";
        if (this.instance.has("verbose")) Loglevel.level = "verbose";
        if (this.instance.has("info")) Loglevel.level = "info";
        if (this.instance.has("warning")) Loglevel.level = "warning";
        if (this.instance.has("error")) Loglevel.level = "error";
        if (this.instance.has("silent")) Loglevel.level = "silent";

        return this.instance;
    }

    static toggle(key: string) { return this.instance.toggle(key) }
    static get(key: string) { return this.instance.get(key) }
    static set(key: string, value: Input) { return this.instance.set(key, value) }
    static add(key: string, value: Input) { return this.instance.add(key, value) }
    static has(key: string) { return this.instance.has(key) }
    static string(key: string) { return this.instance.string(key) }
    static number(key: string) { return this.instance.number(key) }
}

(function () {
    Arguments.init(process.argv);
}())