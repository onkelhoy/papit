
export type SpriteAnimation = {
    frames: number[];
    fps: number;
    loop: boolean;
};

// Generic, reusable — could live in @papit/game-engine as SpriteAnimator
export class SpriteAnimator<TName extends string> {
    private time = 0;
    private frameIndex = 0;
    private current: SpriteAnimation;
    private currentName: TName;
    private onComplete?: () => void;

    constructor(
        private animations: Record<TName, SpriteAnimation>,
        initial: TName
    ) {
        this.currentName = initial;
        this.current = animations[initial];
    }

    get name() {
        return this.currentName;
    }

    get frame(): number {
        return this.current.frames[this.frameIndex];
    }

    /** Switch clips. No-op if already playing `name` (so calling play() every frame from draw() is safe). */
    play(name: TName, onComplete?: () => void) {
        if (this.currentName === name) return;
        this.currentName = name;
        this.current = this.animations[name];
        this.time = 0;
        this.frameIndex = 0;
        this.onComplete = onComplete;
    }

    update(delta: number) {
        const frameDuration = 1000 / this.current.fps;
        this.time += delta;

        while (this.time >= frameDuration)
        {
            this.time -= frameDuration;
            this.frameIndex++;

            if (this.frameIndex >= this.current.frames.length)
            {
                if (this.current.loop)
                {
                    this.frameIndex = 0;
                } else
                {
                    this.frameIndex = this.current.frames.length - 1;
                    this.onComplete?.();
                }
            }
        }
    }
}