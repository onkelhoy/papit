import { Spritesheet } from "@papit/2d-spritesheet"
import { Engine, LoadImage, Pixel, Pixels } from "@papit/game-engine";
import { Polygon } from "@papit/polygon";
import { GeneratePolygon, DrawPolygon } from "@papit/game-shape";

const SPRITES = {
    top: [0, 1],
    left: [2, 3],
    right: [4, 5],
    bottom: [6, 7],
    "top-left": [8, 9],
    "top-left-right": [10, 11],
    "top-right": [12, 13],
    "bottom-left": [14, 15],
    "bottom-right": [16, 17],
    filler: [18, 19, 20], // ground with no edges 
}

function getSpriteKey(key: string): keyof typeof SPRITES {
    if (key in SPRITES) return key as keyof typeof SPRITES;

    return "filler";
}

type Tile = {
    sprite: number;
    x: number;
    y: number;
}

const SIZE = 24;
export class WorldMap {
    private spritesheet: Spritesheet;
    private tiles: Tile[] = [];
    private pixels!: Pixels;
    public polygons: Polygon[] = [];

    constructor() {
        this.spritesheet = new Spritesheet("/ground.png", 5, 5);
    }

    async load() {
        await this.spritesheet.load();

        this.pixels = await Pixels.FromImage("/map.png");

        this.polygons = await GeneratePolygon("/map.png", SIZE);

        for (let p of this.pixels) 
        {
            if (p.a === 0) continue;

            const surrounding = this.pixels.surrounding(p);

            const axis: { x: Array<"left" | "right">, y: Array<"top" | "bottom"> } = {
                y: [],
                x: [],
            }
            if (surrounding.top?.a === 0)
            {
                axis.y.push("top");
            }
            if (surrounding.bottom?.a === 0)
            {
                axis.y.push("bottom");
            }
            if (surrounding.left?.a === 0)
            {
                axis.x.push("left");
            }
            if (surrounding.right?.a === 0)
            {
                axis.x.push("right");
            }

            const key = [axis.y.join("-"), axis.x.join("-")].filter(Boolean).join("-");
            this.tiles.push({
                sprite: this.getRandomSprite(getSpriteKey(key)),
                x: p.col,
                y: p.row,
            });
        }
    }

    get width() {
        return this.pixels.width * SIZE;
    }

    get height() {
        return this.pixels.height * SIZE;
    }

    private getRandomSprite(key: keyof typeof SPRITES) {
        return SPRITES[key][Math.round(Math.random() * (SPRITES[key].length - 1))];
    }

    draw(boundary = false) {
        if (!Engine.instance) return;
        if (this.spritesheet.frameWidth === null) return;
        if (this.spritesheet.frameHeight === null) return;

        if (boundary)
        {
            for (const polygon of this.polygons) 
            {
                DrawPolygon(polygon, Engine.instance.ctx, { strokecolor: "white" });
            }
        }

        for (const tile of this.tiles)
        {
            this.spritesheet.draw(Engine.instance.ctx, tile.sprite, {
                x: tile.x * SIZE, // this.spritesheet.frameWidth,
                y: tile.y * SIZE, // this.spritesheet.frameHeight,
                width: SIZE,
                height: SIZE,
            });
        }
    }
}