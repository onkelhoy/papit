// game.ts
import { Engine, InputEvents } from "@papit/game-engine";
import { bind } from "@papit/web-component";

// local 
import { Alphabet } from "game/alphabet";
import { Character } from "game/character";
import { WorldMap } from "game/world"
import { Camera } from "game/camera"

const VERBOSE = true;

export class Game {
    private engine: Engine;
    private alphabet: Alphabet;
    private name: string;
    private player: Character;
    private events: InputEvents;
    private world: WorldMap;
    private camera: Camera;

    constructor(documentElement: ShadowRoot, name: string) {
        this.engine = new Engine({
            query: "canvas",
            documentElement,
            global: true,
        });
        this.events = new InputEvents(this.engine.canvas, {
            global: true,
            mouse: {
                pointerlock: undefined,
            }
        });
        this.engine.resizeCanvasToDisplaySize();
        this.camera = new Camera(this.engine.width, this.engine.height);
        this.camera.setEase(0.08);
        this.camera.setDeadzone(50, 40);

        this.world = new WorldMap();

        this.name = name;
        this.alphabet = new Alphabet();
        this.player = new Character(0, 400);

        this.load();
    }

    async load() {
        await this.alphabet.load();
        await this.world.load();                    // loads the world and sets this.world.width/height
        await this.player.load();

        // Set camera bounds immediately after world is loaded
        this.camera.setBounds(0, 0, this.world.width, this.world.height);

        this.engine.loop(this.draw);
    }

    @bind
    draw(delta: number) {
        this.player.update(this.events, delta, this.world.polygons);

        // Camera follows the player
        this.camera.follow(this.player.position.x, this.player.position.y);
        this.camera.update();

        // Clear and apply camera transform
        this.engine.ctx.clearRect(0, 0, this.engine.width, this.engine.height);
        this.engine.ctx.save();
        this.engine.ctx.translate(-this.camera.getX(), -this.camera.getY());

        // Draw everything in world space
        this.world.draw(VERBOSE);
        this.alphabet.print(this.engine.ctx, this.name, {
            x: this.player.position.x,
            y: this.player.position.y - 100,
            pivotx: 50,
        });
        this.player.draw(delta, VERBOSE);

        this.engine.ctx.restore();
    }
}