// camera.ts
import { Vector2 } from "@papit/vector";

export class Camera {
    private position: Vector2;
    private target: Vector2;
    private viewport: Vector2;
    private deadzone: Vector2;
    private boundsMin: Vector2;
    private boundsMax: Vector2;

    private ease: number = 0.08;
    private threshold: number = 0.01;

    constructor(viewportWidth: number, viewportHeight: number) {
        this.viewport = new Vector2(viewportWidth, viewportHeight);
        this.position = new Vector2(0, 0);
        this.target = new Vector2(0, 0);
        this.deadzone = new Vector2(0, 0);
        this.boundsMin = new Vector2(-Infinity, -Infinity);
        this.boundsMax = new Vector2(Infinity, Infinity);
    }

    /**
     * Set the target for the camera to follow.
     * The target is typically the player's world position.
     */
    follow(targetX: number, targetY: number): void {
        const ideal = new Vector2(
            targetX - this.viewport.x / 2,
            targetY - this.viewport.y / 2
        );

        if (this.deadzone.x > 0 || this.deadzone.y > 0)
        {
            const screenPos = new Vector2(targetX, targetY).subtract(this.position);
            const center = this.viewport.clone.multiply(0.5);

            const diff = screenPos.subtract(center);
            if (Math.abs(diff.x) > this.deadzone.x)
            {
                this.target.x = ideal.x;
            }
            if (Math.abs(diff.y) > this.deadzone.y)
            {
                this.target.y = ideal.y;
            }
        } else
        {
            // Copy values from ideal to target
            this.target.x = ideal.x;
            this.target.y = ideal.y;
        }

        this.clampTarget();
    }

    /**
     * Update the camera's position towards the target with easing.
     * Call this once per frame.
     */
    update(): void {
        const delta = Vector2.subtract(this.target, this.position);
        const dist = delta.magnitude;

        if (dist < this.threshold)
        {
            this.position.x = this.target.x;
            this.position.y = this.target.y;
            return;
        }

        const easeFactor = 1 - Math.pow(1 - this.ease, 1);
        // Multiply delta by easeFactor and add to position
        this.position.add(delta.multiply(easeFactor));

        // Snap if very close
        if (Math.abs(this.position.x - this.target.x) < this.threshold)
        {
            this.position.x = this.target.x;
        }
        if (Math.abs(this.position.y - this.target.y) < this.threshold)
        {
            this.position.y = this.target.y;
        }

        this.clampPosition();
    }

    /**
     * Update the viewport size (e.g., on window resize).
     */
    setViewport(width: number, height: number): void {
        this.viewport.x = width;
        this.viewport.y = height;
        this.clampTarget();
        this.clampPosition();
    }

    /**
     * Set the world bounds for the camera.
     * The camera will never move outside these bounds.
     */
    setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
        this.boundsMin.x = minX;
        this.boundsMin.y = minY;
        this.boundsMax.x = maxX - this.viewport.x;
        this.boundsMax.y = maxY - this.viewport.y;
        this.clampTarget();
        this.clampPosition();
    }

    /**
     * Set the easing factor (0 = no easing, 1 = instant snap).
     */
    setEase(ease: number): void {
        this.ease = Math.max(0.01, Math.min(1, ease));
    }

    /**
     * Set the deadzone (pixels) around the center where the camera doesn't move.
     */
    setDeadzone(deadzoneX: number, deadzoneY: number): void {
        this.deadzone.x = deadzoneX;
        this.deadzone.y = deadzoneY;
    }

    /**
     * Instantly snap the camera to the target.
     */
    snap(): void {
        this.position.x = this.target.x;
        this.position.y = this.target.y;
    }

    /** Get the current X position (world space). */
    getX(): number {
        return this.position.x;
    }

    /** Get the current Y position (world space). */
    getY(): number {
        return this.position.y;
    }

    /** Get the current position as a {x, y} object. */
    getPosition(): { x: number; y: number } {
        return { x: this.position.x, y: this.position.y };
    }

    /** Get the current position as a Vector2 (clone). */
    getPositionVector(): Vector2 {
        return this.position.clone;
    }

    /**
     * Check if a world-space point is visible within the viewport,
     * with an optional margin.
     */
    isVisible(x: number, y: number, margin: number = 0): boolean {
        return x >= this.position.x - margin &&
            x <= this.position.x + this.viewport.x + margin &&
            y >= this.position.y - margin &&
            y <= this.position.y + this.viewport.y + margin;
    }

    /**
     * Convert a world-space point to screen space.
     */
    worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
        return { x: worldX - this.position.x, y: worldY - this.position.y };
    }

    /**
     * Convert a screen-space point to world space.
     */
    screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        return { x: screenX + this.position.x, y: screenY + this.position.y };
    }

    // ------------------- Private helpers -------------------

    private clampTarget(): void {
        // Clamp target to bounds
        if (this.target.x < this.boundsMin.x) this.target.x = this.boundsMin.x;
        if (this.target.x > this.boundsMax.x) this.target.x = this.boundsMax.x;
        if (this.target.y < this.boundsMin.y) this.target.y = this.boundsMin.y;
        if (this.target.y > this.boundsMax.y) this.target.y = this.boundsMax.y;
    }

    private clampPosition(): void {
        if (this.position.x < this.boundsMin.x) this.position.x = this.boundsMin.x;
        if (this.position.x > this.boundsMax.x) this.position.x = this.boundsMax.x;
        if (this.position.y < this.boundsMin.y) this.position.y = this.boundsMin.y;
        if (this.position.y > this.boundsMax.y) this.position.y = this.boundsMax.y;
    }
}