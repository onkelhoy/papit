import { Spritesheet, SpriteAnimator, SpriteAnimation } from "@papit/2d-spritesheet";
import { Engine, InputEvents } from "@papit/game-engine";
import { Vector2 } from "@papit/vector";
import { Polygon, Rectangle } from "@papit/game-shape";
import { bind, property } from "@papit/web-component";
import { SAT } from "@papit/game-intersection";


// Constants
const SPEED = 3.2;
const GRAVITY = 0.6;
const GROUND_Y = 1200;
const MIN_JUMP_FORCE = -10;   // tap / short charge
const JUMP_FORCE = -26;       // max charge
const MAX_CHARGE_MS = 550;    // how long full charge takes

// Add a charging animation, reusing the landing/crouch frame
const CHARACTER_ANIMATIONS = {
    walk: { frames: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
    idleStill: { frames: [6], fps: 1, loop: true },
    idleBlink: { frames: [7], fps: 8, loop: false },
    idleBreathe: { frames: [8], fps: 4, loop: false },
    falling: { frames: [9, 10], fps: 6, loop: true },
    landing: { frames: [11], fps: 8, loop: false },
    charging: { frames: [11], fps: 8, loop: true },
} satisfies Record<string, SpriteAnimation>;

type AnimName = keyof typeof CHARACTER_ANIMATIONS;

export class Character {
    private spritesheet: Spritesheet;
    private spritestate: "idle" | "walking" | "falling" | "landing" | "charging" = "idle";
    private animator: SpriteAnimator<AnimName>;

    public position: Vector2;
    public velocity: Vector2;
    private boundary: Rectangle;
    private flipped = false;
    private grounded = true;
    private isCharging = false;
    private chargeTime = 0;

    // idle-variant scheduling
    private idleTimer = 0;
    private nextIdleAt = this.randomIdleDelay();

    constructor(x: number, y: number) {
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.spritesheet = new Spritesheet("/character.png", 4, 3);
        this.boundary = new Rectangle(this.position.x, this.position.y, 80, 120);
        this.animator = new SpriteAnimator<AnimName>(CHARACTER_ANIMATIONS, "idleStill");
    }

    async load() {
        await this.spritesheet.load();
    }

    private randomIdleDelay() {
        return 2000 + Math.random() * 3000; // 2-5s between blinks/breaths
    }

    private collisionDetection(worldPolygons: Polygon[]) {

        const bpolygon = this.boundary.polygon;
        let collideGround = false;
        for (const polygon of worldPolygons)
        {
            const sat = SAT(bpolygon, polygon);
            if (!sat) continue;

            const { normal, depth } = sat;
            if (normal.y > 0.5)
            {
                this.velocity.y = 0;

                if (!this.grounded)
                {
                    this.spritestate = "landing";
                    this.isCharging = false
                }
                this.grounded = true;
                collideGround = true;
            }
            this.position.subtract(normal.multiply(depth));
            // console.log(sat);
        }

        this.boundary.x = this.position.x - this.boundary.w / 2;
        this.boundary.y = this.position.y - this.boundary.h;

        if (!collideGround)
        {
            this.grounded = false;
            this.spritestate = "falling";
        }
    }

    counter = 0;
    update(events: InputEvents, delta: number, worldPolygons: Polygon[]) {
        let moving = false;
        this.counter++;
        if (this.counter % 30 === 0)
        {
            this.counter = 0;
            console.log(this.spritestate);
        }

        if (!this.isCharging)
        {
            if (events.key("arrowright")?.pressed)
            {
                this.position.x += SPEED;
                this.flipped = false;
                moving = true;
            }
            else if (events.key("arrowleft")?.pressed)
            {
                this.position.x -= SPEED;
                this.flipped = true;
                moving = true;
            }
        }

        // Edge detection for space - simplified
        // const spaceKey = events.key(" ");
        // const spaceDown = spaceKey?.pressed === true;
        // const spacePressed = spaceDown && !this.wasSpaceDown;
        // const spaceReleased = !spaceDown && this.wasSpaceDown;
        // this.wasSpaceDown = spaceDown;

        // console.log("Space:", { spaceDown, spacePressed, spaceReleased, isCharging: this.isCharging, grounded: this.grounded });

        // Charge / jump logic
        if (this.grounded)
        {
            if (events.key(" ")?.pressed)
            {
                if (!this.isCharging)
                {
                    this.isCharging = true;
                    this.chargeTime = 0;
                    this.spritestate = "charging";
                }
            }

            if (this.isCharging)
            {
                this.chargeTime = Math.min(this.chargeTime + delta, MAX_CHARGE_MS);

                if (!events.key(" ")?.pressed)
                {
                    const t = this.chargeTime / MAX_CHARGE_MS;
                    const jumpForce = MIN_JUMP_FORCE + (JUMP_FORCE - MIN_JUMP_FORCE) * t;

                    this.velocity.y = jumpForce;
                    this.grounded = false;
                    this.isCharging = false;
                    this.spritestate = "falling";
                }
            }
        }
        else
        {
            // Cancel charge if we somehow leave the ground while charging
            this.isCharging = false;
        }

        // Rest of the update method remains the same...
        // Gravity
        if (!this.grounded)
        {
            this.velocity.y += GRAVITY;
            this.position.y += this.velocity.y;
        }

        // // Ground collision
        // if (this.position.y >= GROUND_Y)
        // {
        //     this.position.y = GROUND_Y;

        //     if (!this.grounded)
        //     {
        //         this.spritestate = "landing";
        //     }

        //     this.velocity.y = 0;
        //     this.grounded = true;
        //     // this.isCharging = false;
        // }

        // State resolution
        if (!this.grounded)
        {
            this.spritestate = "falling";
        } else if (this.isCharging)
        {
            this.spritestate = "charging";
        } else if (this.spritestate !== "landing")
        {
            this.spritestate = moving ? "walking" : "idle";
        }

        this.boundary.x = this.position.x - this.boundary.w / 2;
        this.boundary.y = this.position.y - this.boundary.h;

        this.collisionDetection(worldPolygons)
    }

    draw(delta: number, boundary = false) {
        if (!Engine.instance) return;

        switch (this.spritestate)
        {
            case "walking":
                this.animator.play("walk");
                break;
            case "falling":
                this.animator.play("falling");
                break;
            case "landing":
                this.animator.play("landing", () => {
                    this.spritestate = "idle";
                });
                break;
            case "charging":
                this.animator.play("charging");
                break;
            case "idle":
            default:
                this.updateIdle(delta);
                break;
        }

        this.animator.update(delta);

        Engine.instance.ctx.save();
        Engine.instance.ctx.translate(this.position.x, this.position.y);
        if (this.flipped)
        {
            Engine.instance.ctx.scale(-1, 1);
        }
        this.spritesheet.draw(Engine.instance.ctx, this.animator.frame, {
            x: 0,
            y: 0,
            width: 120,
            height: 120,
            pivotx: 50,
            pivoty: 100,
        });
        Engine.instance.ctx.restore();

        if (boundary)
        {
            this.boundary.draw(Engine.instance.ctx);
        }
    }

    private updateIdle(delta: number) {
        // don't interrupt a blink/breathe that's already mid-playback
        if (this.animator.name === "idleBlink" || this.animator.name === "idleBreathe") return;

        this.idleTimer += delta;
        if (this.idleTimer < this.nextIdleAt)
        {
            this.animator.play("idleStill");
            return;
        }

        this.idleTimer = 0;
        this.nextIdleAt = this.randomIdleDelay();
        const variant: AnimName = Math.random() < 0.7 ? "idleBlink" : "idleBreathe";
        this.animator.play(variant, () => this.animator.play("idleStill"));
    }
}