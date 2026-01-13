export type LexerAction<Ctx, Token> = (
    ctx: Ctx & {
        append: (char: string) => void;
        emit: (token: Token) => void
    },
    char: string,
    buffer: string,
) => void;

export interface StateRule<Ctx, Token> {
    condition: string | RegExp | ((char?: string, index?: number) => boolean);
    next?: string;
    action?: LexerAction<Ctx, Token>;
}

export interface StateRules<Ctx = any, Token = any> {
    [state: string]: StateRule<Ctx, Token>[];
}

export class Lexer<Ctx = any, Token = any> {
    private state: string;
    private buffer: string = "";
    private tokens: Token[] = [];
    private ctx: Ctx & {
        append: (char: string) => void;
        emit: (token: Token) => void
    };

    constructor(
        private rules: StateRules<Ctx>,
        initialState: string,
        initialCtx: Ctx,
    ) {
        this.state = initialState;

        // Extend context with helper methods
        this.ctx = {
            ...initialCtx,
            append: (char: string) => {
                this.buffer += char;
            },
            emit: (token: Token) => {
                this.tokens.push(token);
                this.buffer = "";
            }
        };
    }

    run(input: string): Token[] {
        for (let i = 0; i < input.length; i++)
        {
            const char = input[i];
            const stateRules = this.rules[this.state];
            let matched = false;

            for (const rule of stateRules)
            {
                let match = false;

                if (typeof rule.condition === "string")
                {
                    match = char === rule.condition;
                } else if (rule.condition instanceof RegExp)
                {
                    match = rule.condition.test(char);
                } else if (typeof rule.condition === "function")
                {
                    match = rule.condition(char, i);
                }

                if (match)
                {
                    matched = true;
                    if (rule.action)
                    {
                        rule.action(this.ctx, char, this.buffer);
                    }
                    if (rule.next)
                    {
                        this.state = rule.next;
                    }
                    break;
                }
            }

            // Default fallback: append if no rule matched
            if (!matched)
            {
                this.ctx.append(char);
            }
        }

        // Flush remaining buffer
        if (this.buffer && this.rules["EOF"])
        {
            this.rules["EOF"].at(0)?.action?.(this.ctx, "EOF", this.buffer);
        }

        return this.tokens;
    }
}