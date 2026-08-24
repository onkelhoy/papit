// import statements 
import { LoadImage } from "@papit/game-engine";
import { Vector2 } from "@papit/vector";

type Config = {
    col: number;
    row: number;
    padding: number;
}
type DrawOptions = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    pivotx?: number; /* percentage [0-100], offsets x so (x,y) is the pivot point, not top-left */
    pivoty?: number; /* percentage [0-100] */
}

export class Spritesheet {
    public image!: HTMLImageElement;
    public config: Partial<Config>;

    private _frameWidth: number | null = null;
    public get frameWidth() {
        if (this._frameWidth !== null) return this._frameWidth;
        if (!this.image) return null;

        const imageWidth = this.image.width;
        const cols = this.config?.col ?? 1;
        const padding = this.config?.padding ?? 0;

        // Fix: Calculate frame width correctly with padding
        this._frameWidth = Math.floor((imageWidth - padding * (cols + 1)) / cols);
        return this._frameWidth;
    }

    private _frameHeight: number | null = null;
    public get frameHeight() {
        if (this._frameHeight !== null) return this._frameHeight;
        if (!this.image) return null;

        const imageHeight = this.image.height;
        const rows = this.config?.row ?? 1;
        const padding = this.config?.padding ?? 0;

        // Fix: Calculate frame height correctly with padding
        this._frameHeight = Math.floor((imageHeight - padding * (rows + 1)) / rows);
        return this._frameHeight;
    }

    private configImage: HTMLImageElement | string;

    constructor(image: HTMLImageElement | string, config: Partial<Config>);
    constructor(image: HTMLImageElement | string, row: number, col: number);
    constructor(image: HTMLImageElement | string, row: number, col: number, padding: number);
    constructor(image: HTMLImageElement | string, rowOrConfig: Partial<Config> | number, col?: number, padding?: number) {
        this.configImage = image;

        if (typeof rowOrConfig === "number")
        {
            this.config = {
                col: col,
                row: rowOrConfig,
                padding: padding ?? 0,
            }
        } else
        {
            this.config = rowOrConfig;
        }
    }

    async load() {
        if (this.configImage instanceof HTMLImageElement)
        {
            this.image = this.configImage;
        }

        else
        {
            const image = await LoadImage(this.configImage)
            this.image = image;
        }
    }

    // Cleaner overloads with options object
    draw(ctx: CanvasRenderingContext2D, col: number, row: number, options?: DrawOptions): void;
    draw(ctx: CanvasRenderingContext2D, index: number, options?: DrawOptions): void;
    draw(ctx: CanvasRenderingContext2D, colOrIndex: number, rowOrOptions?: number | DrawOptions, options?: DrawOptions): void {
        const frameWidth = this.frameWidth;
        const frameHeight = this.frameHeight;
        const padding = this.config?.padding ?? 0;

        if (!this.image || frameWidth === null || frameHeight === null)
        {
            console.warn('Spritesheet not loaded or invalid frame dimensions');
            return;
        }

        let col: number;
        let row: number;
        let opts: DrawOptions = {};

        if (typeof rowOrOptions === 'number')
        {
            col = colOrIndex;
            row = rowOrOptions;
            opts = options || {};
        } else
        {
            const index = colOrIndex;
            const cols = this.config?.col ?? 1;
            col = index % cols;
            row = Math.floor(index / cols);
            opts = rowOrOptions || {};
        }

        const {
            x = 0,
            y = 0,
            width = frameWidth,
            height = frameHeight,
            pivotx = 0,
            pivoty = 0,
        } = opts;

        const sourceX = padding + col * (frameWidth + padding);
        const sourceY = padding + row * (frameHeight + padding);

        // pivot offset — (x,y) now refers to the pivot point on the drawn sprite,
        // not always its top-left corner
        const drawX = x - (pivotx / 100) * width;
        const drawY = y - (pivoty / 100) * height;

        ctx.drawImage(
            this.image,
            sourceX, sourceY,
            frameWidth, frameHeight,
            drawX, drawY,
            width, height
        );
    }
}