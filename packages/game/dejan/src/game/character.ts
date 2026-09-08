import { Spritesheet, SpriteAnimator, SpriteAnimation } from "@papit/2d-spritesheet";
import { Engine, InputEvents } from "@papit/game-engine";
import { Vector2 } from "@papit/vector";
import { Polygon } from "@papit/polygon";
import { SAT } from "@papit/sat";
import { Pill } from "./pill";


// Constants
const SPEED = 3.2;
const GRAVITY = 0.6;
const MIN_JUMP_FORCE = -10;   // tap / short charge
const JUMP_FORCE = -26;       // max charge
const MAX_CHARGE_MS = 550;    // how long full charge takes

// Collision solver tuning
const MAX_RESOLUTION_PASSES = 2;
const SLOPE_THRESHOLD = 0.5;  // |normal.y| above this => floor/ceiling, else wall

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
    private boundary: Pill;
    private flipped = false;
    private grounded = true;
    private groundNormal: Vector2 | null = null;
    private isCharging = false;
    private chargeTime = 0;
    private readonly MAX_FALL_SPEED = 30;

    // idle-variant scheduling
    private idleTimer = 0;
    private nextIdleAt = this.randomIdleDelay();

    // debug-only: last push direction, for the verbose normal arrow
    private debugPush: Vector2 | null = null;

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

    private resolveCollisions(worldPolygons: Polygon[]): { grounded: boolean; groundNormal: Vector2 | null } {
        let grounded = false;
        let groundNormal: Vector2 | null = null;
        this.debugPush = null;

        for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++)
        {
            let anyCollision = false;
            let anyGround = false;

            for (const polygon of worldPolygons)
            {
                const sat = SAT(this.boundary.polygon, polygon);
                if (!sat) continue;

                const { normal, overlap } = sat;
                anyCollision = true;

                const push = normal.clone.multiply(overlap);
                this.position.subtract(push);
                this.boundary.update(this.position);

                const vDotN = this.velocity.dot(normal);
                if (vDotN < 0)
                {
                    this.velocity.subtract(normal.clone.multiply(vDotN));
                }

                if (normal.y > SLOPE_THRESHOLD)
                {
                    anyGround = true;
                    groundNormal = normal.clone;
                    this.debugPush = push;
                }
            }

            if (!anyCollision) break;
            if (anyGround) grounded = true;
        }

        return { grounded, groundNormal };
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
        let dir = 0;

        if (!this.isCharging)
        {
            if (events.key("arrowright")?.pressed)
            {
                dir = 1;
                this.flipped = false;
                moving = true;
            }
            else if (events.key("arrowleft")?.pressed)
            {
                dir = -1;
                this.flipped = true;
                moving = true;
            }


            if (events.key("arrowup")?.pressed)
            {
                this.velocity.y = -SPEED;
            }
            else if (events.key("arrowdown")?.pressed)
            {
                this.velocity.y = SPEED;
            }
            else 
            {
                this.velocity.y = 0;
            }
        }

        // Horizontal movement: projected onto the ground tangent when grounded,
        // so walking into a slope naturally becomes walking UP the slope instead
        // of just butting into it and relying on collision push-out to sort it out.
        if (this.isCharging)
        {
            this.velocity.x = 0;
        }
        else if (this.grounded && this.groundNormal)
        {
            const n = this.groundNormal;
            // tangent = normal rotated 90°, kept pointing in +x so `dir` maps intuitively
            let tx = -n.y;
            let ty = n.x;
            if (tx < 0) { tx = -tx; ty = -ty; }
            this.velocity.x = tx * dir * SPEED;
            this.velocity.y = ty * dir * SPEED;
        }
        else
        {
            // Airborne (or no cached ground normal yet): plain horizontal control.
            this.velocity.x = dir * SPEED;
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
                    this.groundNormal = null;
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
        this.boundary.update(this.position);

        const wasGrounded = this.grounded;
        let { grounded, groundNormal } = this.resolveCollisions(worldPolygons);

        if (grounded && !wasGrounded)
        {
            this.spritestate = "landing";
            this.isCharging = false;
        }

        this.grounded = grounded;
        this.groundNormal = groundNormal;

        if (!grounded)
        {
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

        Engine.ctx.save();
        Engine.ctx.translate(this.position.x, this.position.y);
        if (this.flipped)
        {
            Engine.ctx.scale(-1, 1);
        }
        this.spritesheet.draw(Engine.ctx, this.animator.frame, {
            x: 0,
            y: 0,
            width: 120,
            height: 120,
            pivotx: 40,
            pivoty: 50,
        });
        Engine.ctx.restore();

        if (verbose)
        {
            this.boundary.draw(Engine.ctx, this.grounded ? "yellow" : "white");

            if (this.debugPush)
            {
                const ctx = Engine.ctx;
                const cx = this.boundary.center.x;
                const cy = this.boundary.center.y;
                const angle = this.debugPush.angle;
                const mag = this.debugPush.magnitude * 10 + 30; // exaggerate for visibility

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
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}