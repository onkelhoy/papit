import { Spritesheet } from "@papit/2d-spritesheet";

const ALPHABET_MAP = new Map(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäö"
        .split("")
        .map((key, index) => [key, index])
);

type PrintConfig = {
    x: number;
    y: number;
    pivotx: number; /* percentage number [0-100] */
    pivoty: number; /* percentage number [0-100] */
    size: number;
    spacing: number; /* additional spacing between letters */
}

const defaultPrintConfig: PrintConfig = {
    x: 0,
    y: 0,
    pivotx: 0,
    pivoty: 0,
    size: 32,
    spacing: -16,
}

export class Alphabet extends Spritesheet {

    constructor() {
        super("/alphabet.png", {
            col: 8,
            row: 8,
        })
    }

    print(ctx: CanvasRenderingContext2D, sentence: string, config?: Partial<PrintConfig>) {
        const conf = { ...defaultPrintConfig, ...(config ?? {}) };

        ctx.imageSmoothingEnabled = false;

        // Calculate total width to apply pivot offset
        const totalChars = sentence.length;
        const totalWidth = totalChars * (conf.size + conf.spacing) - conf.spacing;
        const totalHeight = conf.size;

        // Calculate offset based on pivot percentages
        const pivotOffsetX = (conf.pivotx / 100) * totalWidth;
        const pivotOffsetY = (conf.pivoty / 100) * totalHeight;

        // Starting position with pivot offset
        let x = conf.x - pivotOffsetX;
        const y = conf.y - pivotOffsetY;

        for (let i = 0; i < sentence.length; i++)
        {
            const letter = sentence[i];

            if (letter === " ")
            {
                x += conf.size + conf.spacing;
                continue;
            }

            const index = ALPHABET_MAP.get(letter);
            if (index === undefined) continue;

            this.draw(ctx, index, {
                width: conf.size,
                height: conf.size,
                x: x,
                y: y,
            });

            x += conf.size + conf.spacing;
        }

        ctx.imageSmoothingEnabled = true;
    }
}