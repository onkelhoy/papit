import { Spritesheet, SpriteAnimator, SpriteAnimation } from "@papit/2d-spritesheet";
import { Engine, InputEvents } from "@papit/game-engine";
import { Vector2 } from "@papit/vector";
import { Rectangle } from "@papit/game-shape";
import { Polygon } from "@papit/polygon";
import { bind, property } from "@papit/web-component";
import { SAT } from "@papit/sat";
import { Pill } from "./pill";


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
    // private boundary: Rectangle;
    private boundary: Pill;
    private flipped = false;
    private grounded = true;
    private isCharging = false;
    private chargeTime = 0;
    private counter = 0;
    private readonly MAX_FALL_SPEED = 30;

    // idle-variant scheduling
    private idleTimer = 0;
    private nextIdleAt = this.randomIdleDelay();
    private normal: Vector2 | null = null;

    constructor(x: number, y: number) {
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.spritesheet = new Spritesheet("/character.png", 4, 3);
        this.boundary = new Pill(80, 120);
        this.animator = new SpriteAnimator<AnimName>(CHARACTER_ANIMATIONS, "idleStill");
    }

    async load() {
        await this.spritesheet.load();
    }

    private randomIdleDelay() {
        return 2000 + Math.random() * 3000; // 2-5s between blinks/breaths
    }

    private collisionDetection(worldPolygons: Polygon[]): { collision: boolean; collideGround: boolean } {
        let collideGround = false;
        let collision = false;

        for (const polygon of worldPolygons)
        {
            const sat = SAT(this.boundary.polygon, polygon);
            if (!sat) continue;
            collision = true;

            let { normal, overlap } = sat;
            this.normal = normal.clone.multiply(overlap + 0.01);
            this.position.subtract(this.normal);
            this.boundary.update(this.position);

            const vDotN = this.velocity.dot(normal);
            if (vDotN < 0)
            {
                this.velocity.subtract(normal.clone.multiply(vDotN));
            }

            if (normal.y > 0.5)
            {
                collideGround = true;
            }
        }

        if (!collision) this.normal = null;
        return { collision, collideGround };
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

            // if (events.key("arrowup")?.pressed)
            // {
            //     this.velocity.y = -SPEED;
            //     // this.flipped = false;
            //     moving = true;
            // }
            // else if (events.key("arrowdown")?.pressed)
            // {
            //     this.velocity.y = SPEED;
            //     moving = true;
            // }
            // else
            // {
            //     this.velocity.y = 0;
            // }
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
            this.velocity.y += GRAVITY;
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
        this.boundary.update(this.position);

        const MAX_RESOLUTION_PASSES = 4;
        let everGrounded = false;

        for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++)
        {
            const { collision, collideGround } = this.collisionDetection(worldPolygons);
            if (collideGround) everGrounded = true;
            if (!collision) break;
        }

        if (everGrounded)
        {
            if (!this.grounded) { this.spritestate = "landing"; this.isCharging = false; }
            this.grounded = true;
        } else
        {
            this.grounded = false;
            this.spritestate = "falling";
        }
    }

    draw(delta: number, verbose = false) {
        if (!Engine.ctx) return;

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

        // Engine.instance.ctx.save();
        // Engine.instance.ctx.translate(this.position.x, this.position.y);
        // if (this.flipped)
        // {
        //     Engine.instance.ctx.scale(-1, 1);
        // }
        // this.spritesheet.draw(Engine.instance.ctx, this.animator.frame, {
        //     x: 0,
        //     y: 0,
        //     width: 120,
        //     height: 120,
        //     pivotx: 50,
        //     pivoty: 100,
        // });
        // Engine.instance.ctx.restore();

        if (verbose)
        {
            this.boundary.draw(Engine.ctx, "white");

            if (this.normal)
            {
                const ctx = Engine.ctx;
                const cx = this.boundary.center.x;
                const cy = this.boundary.center.y;
                const angle = this.normal.angle;
                const mag = this.normal.magnitude + 30;

                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                const px = -dy; // perpendicular
                const py = dx;

                const tipX = cx + dx * mag;
                const tipY = cy + dy * mag;

                const headLen = Math.min(16, mag * 0.3);
                const headWid = 8;
                const baseX = tipX - dx * headLen;
                const baseY = tipY - dy * headLen;
                const wingBack = headLen * 0.5;

                // 7 points: center → right base → right wing → tip → left wing → left base → center
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(baseX + px * headWid, baseY + py * headWid);
                ctx.lineTo(tipX - dx * wingBack + px * (headWid * 1.3), tipY - dy * wingBack + py * (headWid * 1.3));
                ctx.lineTo(tipX, tipY);
                ctx.lineTo(tipX - dx * wingBack - px * (headWid * 1.3), tipY - dy * wingBack - py * (headWid * 1.3));
                ctx.lineTo(baseX - px * headWid, baseY - py * headWid);
                ctx.lineTo(cx, cy);
                ctx.closePath();

                ctx.fillStyle = 'white';
                ctx.fill();
                ctx.strokeStyle = 'white'; // optional crisp edge
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}