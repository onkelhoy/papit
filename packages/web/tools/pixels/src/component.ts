import { LoadImage } from "./helper";
import { Pixel } from "./types";

/** Every pixel of an image or canvas, by index or by column and row. Iterating goes through them all. */
export class Pixels {
    map: globalThis.Map<number, Pixel>;
    imageData: ImageData;

    constructor(imageData: ImageData) {
        this.imageData = imageData;
        this.map = new globalThis.Map();
        for (let i = 0; i < imageData.data.length; i += 4)
        {
            const p = this.getvalue(imageData, i);
            this.map.set(p.index, p);
        }
    }

    /**
     * Reads an image, loading it first when given a url.
     * @param ctx draws on this context instead of a new canvas, it has to be large enough for the image
     */
    static async FromImage(image: HTMLImageElement | string, ctx?: CanvasRenderingContext2D | null) {
        if (typeof image === "string")
        {
            image = await LoadImage(image);
        }

        if (!ctx)
        {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("something went wrong generating pixels - context is empty");
        }

        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        return new Pixels(imageData);
    }

    /**
     * Reads what is on a 2D canvas right now.
     * @param canvas the element, or a query for it
     * @throws if the element is missing, or its context isn't 2D
     */
    static FromCanvas(canvas: HTMLCanvasElement | string, root: ParentNode = document) {
        const element = typeof canvas === "string" ? root.querySelector<HTMLCanvasElement>(canvas) : canvas;
        if (!element) throw new Error(`[error pixels] could not find element: [${canvas}]`);

        const ctx = element.getContext("2d");
        if (!ctx) throw new Error("[error pixels] the canvas has no 2D context");

        return new Pixels(ctx.getImageData(0, 0, element.width, element.height));
    }

    private getvalue(imageData: ImageData, i: number) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        const index = Math.floor(i / 4);
        const row = Math.floor(index / imageData.width);
        const col = index % imageData.width;

        return {
            r, g, b, a,
            index,
            row,
            col,
        }
    }

    surrounding(pixel: Pixel) {
        const array = [
            this.get(pixel.col - 1, pixel.row - 1), // top-left
            this.get(pixel.col + 0, pixel.row - 1), // top
            this.get(pixel.col + 1, pixel.row - 1), // top-right

            this.get(pixel.col - 1, pixel.row + 0), // left
            this.get(pixel.col + 1, pixel.row + 0), // right

            this.get(pixel.col - 1, pixel.row + 1), // bottom-left
            this.get(pixel.col + 0, pixel.row + 1), // bottom
            this.get(pixel.col + 1, pixel.row + 1), // bottom-right
        ];

        return {
            array,
            "top-left": array[0],
            "top": array[1],
            "top-right": array[2],
            "left": array[3],
            "right": array[4],
            "bottom-left": array[5],
            "bottom": array[6],
            "bottom-right": array[7],
        }
    }

    get width() {
        return this.imageData.width;
    }
    get height() {
        return this.imageData.height;
    }

    get(index: number): Pixel | undefined;
    get(col: number, row: number): Pixel | undefined;
    get(indexOrCol: number, row?: number): Pixel | undefined {

        /*
         * Direct linear-index access.
         */
        if (row === undefined)
        {

            if (
                indexOrCol < 0 ||
                indexOrCol >= this.imageData.width * this.imageData.height
            )
            {
                return undefined;
            }

            return this.map.get(indexOrCol);
        }

        /*
         * Coordinate access.
         */
        const col = indexOrCol;

        /*
         * THIS CHECK IS CRITICAL.
         *
         * Never allow negative/out-of-range coordinates to be converted
         * into a linear index.
         */
        if (
            col < 0 ||
            row < 0 ||
            col >= this.imageData.width ||
            row >= this.imageData.height
        )
        {
            return undefined;
        }

        const index =
            col + row * this.imageData.width;

        return this.map.get(index);
    }

    [Symbol.iterator]() {
        return this.map.values();
    }
}
