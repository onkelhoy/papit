import { Spritesheet, SpriteAnimator, SpriteAnimation } from "@papit/2d-spritesheet";
import { Engine, InputEvents } from "@papit/game-engine";
import { Vector2 } from "@papit/vector";
import { Rectangle } from "@papit/game-shape";
import { Polygon } from "@papit/polygon";
import { bind, property } from "@papit/web-component";
import { SAT } from "@papit/sat";


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
    private counter = 0;
    private readonly MAX_FALL_SPEED = 30;

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

    // private collisionDetection(worldPolygons: Polygon[]) {

    //     const bpolygon = this.boundary.polygon;
    //     let collideGround = false;
    //     for (const polygon of worldPolygons)
    //     {
    //         const sat = SAT(bpolygon, polygon);
    //         if (!sat) continue;

    //         let { axis, overlap } = sat;
    //         console.log('collision', sat, bpolygon)
    //         if (axis.y < -0.5)
    //         {
    //             this.velocity.y = 0;

    //             if (!this.grounded)
    //             {
    //                 this.spritestate = "landing";
    //                 this.isCharging = false
    //             }
    //             this.grounded = true;
    //             collideGround = true;

    //             overlap -= 0.001; // to avoid flickering
    //         }

    //         this.position.subtract(axis.multiply(overlap));
    //     }

    //     this.boundary.x = this.position.x - this.boundary.w / 2;
    //     this.boundary.y = this.position.y - this.boundary.h;

    //     if (!collideGround)
    //     {
    //         this.grounded = false;
    //         this.spritestate = "falling";
    //     }
    // }

    private collisionDetection(worldPolygons: Polygon[]) {
        const bpolygon = this.boundary.polygon;
        let collideGround = false;
        const corrections: { axis: Vector2; overlap: number }[] = [];

        for (const polygon of worldPolygons)
        {
            const sat = SAT(bpolygon, polygon);
            if (!sat) continue;

            let { axis, overlap } = sat;

            // (Optional) ensure the axis is normalised and points away from the world
            // The SAT already does this, but it's safe to re-check.
            if (axis.magnitude === 0) continue;

            // Ground check (now using downward normal)
            if (axis.y < -0.5)
            {
                this.velocity.y = 0;
                if (!this.grounded)
                {
                    this.spritestate = "landing";
                    this.isCharging = false;
                }
                this.grounded = true;
                collideGround = true;
                overlap -= 0.001;   // slight bias to avoid jitter
            }

            corrections.push({ axis, overlap });
        }

        // Apply all corrections at once
        for (const corr of corrections)
        {
            this.position.subtract(corr.axis.multiply(corr.overlap));
        }

        // Update the boundary after all movements
        this.boundary.x = this.position.x - this.boundary.w / 2;
        this.boundary.y = this.position.y - this.boundary.h;

        if (!collideGround)
        {
            this.grounded = false;
            this.spritestate = "falling";
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

    update(events: InputEvents, delta: number, worldPolygons: Polygon[]) {
        let moving = false;

        if (!this.isCharging)
        {
            if (events.key("arrowright")?.pressed)
            {
                this.velocity.x = SPEED;
                this.flipped = false;
                moving = true;
            }
            else if (events.key("arrowleft")?.pressed)
            {
                this.velocity.x = -SPEED;
                this.flipped = true;
                moving = true;
            }
            else
            {
                this.velocity.x = 0;
            }

            if (events.key("arrowup")?.pressed)
            {
                this.velocity.y = -SPEED;
                // this.flipped = false;
                moving = true;
            }
            else if (events.key("arrowdown")?.pressed)
            {
                this.velocity.y = SPEED;
                moving = true;
            }
            else
            {
                this.velocity.y = 0;
            }
        } else
        {
            this.velocity.x = 0;
        }

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
            // this.velocity.y += GRAVITY;
        }

        // State resolution
        if (!this.grounded)
        {
            this.spritestate = "falling";
        }
        else if (this.isCharging)
        {
            this.spritestate = "charging";
        }
        else if (this.spritestate !== "landing")
        {
            this.spritestate = moving ? "walking" : "idle";
        }

        if (this.velocity.y > this.MAX_FALL_SPEED)
        {
            this.velocity.y = this.MAX_FALL_SPEED;
        }

        this.position.add(this.velocity);

        this.boundary.x = this.position.x - this.boundary.w / 2;
        this.boundary.y = this.position.y - this.boundary.h;

        this.collisionDetection(worldPolygons)
    }

    draw(delta: number, verbose = false) {
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

        if (verbose)
        {
            this.counter++;
            if (this.counter % 30 === 0)
            {
                this.counter = 0;
                console.log(this.spritestate);
            }
            this.boundary.draw(Engine.instance.ctx);
        }
    }
}