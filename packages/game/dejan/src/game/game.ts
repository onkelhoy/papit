// game.ts
import { Camera, GameEngine, GameObject, InputEvents, follow } from "@papit/game-engine";

// local 
import { Alphabet } from "game/alphabet";
import { Character } from "game/character";
import { WorldMap } from "game/world"

const VERBOSE = true;
(() => {
    Character.verbose = VERBOSE
})

export class Game extends GameObject {
    private game: GameEngine;
    private alphabet: Alphabet;
    private player: Character;
    private events: InputEvents;
    private map: WorldMap;

    constructor(documentElement: ShadowRoot, name: string) {
        super();
        this.game = new GameEngine({
            query: "canvas",
            documentElement,
            global: true,
        });
        this.events = new InputEvents(this.game.canvas, {
            global: true,
            mouse: {
                pointerlock: undefined,
            }
        });

        this.map = new WorldMap();

        this.name = name;
        this.alphabet = new Alphabet();
        this.player = new Character(0, 400);

        this.load();
    }

    async load() {
        await this.alphabet.load();
        await this.map.load();                    // loads the world and sets this.map.width/height
        await this.player.load();

        this.game.defaultLayer.camera = new Camera({
            bounds: { x: 0, y: 0, width: this.map.width, height: this.map.height },
            controllers: [follow(this.player, { ease: 0.08, deadzone: { x: 50, y: 40 } })],
        });

        this.game.add(this);
        this.game.start();
    }

    override update() {
        this.player.update(this.events, this.game.deltaTime * 1000, this.map.polygons);
    }

    override render() {
        this.map.draw(VERBOSE);
        this.alphabet.print(this.game.ctx, this.name, {
            x: this.player.position.x,
            y: this.player.position.y - 100,
            pivotx: 50,
        });
        this.player.draw(this.game.deltaTime * 1000, VERBOSE);
    }
}
