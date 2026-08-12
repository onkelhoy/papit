// import statements 
// system 
import { bind, CustomElement, html, property } from "@papit/web-component";

import { Engine } from "@papit/game-engine";

// local 
import sheet from "./style.css" with { type: "css" };
import { ParticleSystem } from "particle";

type Placement =
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'center' | 'right'
    | 'bottom-left' | 'bottom' | 'bottom-right'
    | 'random';

export class Confetti extends CustomElement {
    static sheet = sheet;

    private engine!: Engine;
    private particleSystem!: ParticleSystem;
    private isLooping = false;

    private controllButton: HTMLButtonElement | null = null;

    static popSound: HTMLAudioElement;
    static yaySound: HTMLAudioElement;
    static hornSound: HTMLAudioElement;

    @property({ type: String }) placement: Placement = 'bottom';
    @property({ type: Boolean, attribute: "click" }) withClick = false;

    @property({
        attribute: "aria-controls",
        after(this: Confetti) {
            if (this.controllButton)
            {
                this.controllButton.removeEventListener("click", this.handleControlClick);
                this.controllButton = null;
            }

            if (!this.controls) return;
            const root = this.getRootNode();
            if (!(root instanceof ShadowRoot || root instanceof Document)) return;

            this.controllButton = root.querySelector("#" + this.controls);
            this.controllButton?.addEventListener("click", this.handleControlClick);
        }
    }) controls?: string;

    @property({ type: Number }) x?: number;
    @property({ type: Number }) y?: number;

    constructor() {
        super();

        if (!Confetti.popSound)
        {
            Confetti.popSound = new Audio("/pop.mp3");
            Confetti.popSound.load();
        }

        if (!Confetti.yaySound)
        {
            Confetti.yaySound = new Audio("/yay.mp3");
            Confetti.yaySound.load();
        }

        if (!Confetti.hornSound)
        {
            Confetti.hornSound = new Audio("/horn.mp3");
            Confetti.hornSound.load();
        }

        // Get initial canvas size
        const rect = this.getBoundingClientRect();
        const width = rect.width || 100;
        const height = rect.height || 100;

        this.particleSystem = new ParticleSystem({
            colors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BD6', '#FF9F43'],
            gravity: 0.08,
            particleCount: 120,
            speedMin: 2,
            speedMax: 6,
            sizeMin: 4,
            sizeMax: 15,
            spread: Math.PI * 1.0,
            upwardBias: 0.8,
            canvasWidth: width,
            canvasHeight: height,
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        if (this.controllButton)
        {
            this.controllButton.removeEventListener("click", this.handleControlClick);
        }
    }

    firstRender(): void {
        super.firstRender();

        this.engine = new Engine({
            query: "canvas",
            documentElement: this.shadowRoot!,
        });

        this.engine.resizeCanvasToDisplaySize();
    }

    private getPosition(): { x: number, y: number } {
        const width = this.engine.width;
        const height = this.engine.height;
        const margin = 20;

        if (this.placement === 'random')
        {
            const placements: Placement[] = [
                'top-left', 'top', 'top-right',
                'left', 'center', 'right',
                'bottom-left', 'bottom', 'bottom-right'
            ];
            const randomPlacement = placements[Math.floor(Math.random() * placements.length)];
            return this.getPositionForPlacement(randomPlacement, width, height, margin);
        }

        return this.getPositionForPlacement(this.placement, width, height, margin);
    }

    private getPositionForPlacement(
        placement: Placement,
        width: number,
        height: number,
        margin: number
    ): { x: number, y: number } {

        if (this.x !== undefined && this.y !== undefined)
        {
            return {
                x: this.x,
                y: this.y,
            }
        }

        const positions: Record<Placement, { x: number, y: number }> = {
            'top-left': { x: margin, y: margin },
            'top': { x: width / 2, y: margin },
            'top-right': { x: width - margin, y: margin },
            'left': { x: margin, y: height / 2 },
            'center': { x: width / 2, y: height / 2 },
            'right': { x: width - margin, y: height / 2 },
            'bottom-left': { x: margin, y: height - margin },
            'bottom': { x: width / 2, y: height - margin },
            'bottom-right': { x: width - margin, y: height - margin },
            'random': { x: width / 2, y: height / 2 },
        };

        return positions[placement] || positions['bottom'];
    }

    start({
        amount = 100,
        sound = true,
        placement,
        clear = false,
    }: Partial<{
        amount: number,
        sound: boolean | Partial<{ pop: boolean, yay: boolean, horn: boolean }>,
        placement: Placement,
        clear: boolean,
    }> = {}) {
        if (placement)
        {
            this.placement = placement;
        }

        // Play sounds
        if (sound)
        {
            if (sound === true || sound.pop)
            {
                Confetti.popSound.pause();
                Confetti.popSound.currentTime = 0;
                Confetti.popSound.volume = 0.3;
                Confetti.popSound.play();
            }

            if (sound === true || sound.yay)
            {
                Confetti.yaySound.pause();
                Confetti.yaySound.currentTime = 0;
                Confetti.yaySound.volume = 0.23;
                Confetti.yaySound.play();
            }

            if (sound === true || sound.horn)
            {
                setTimeout(() => {
                    Confetti.hornSound.pause();
                    Confetti.hornSound.currentTime = 0;
                    Confetti.hornSound.volume = 0.08;
                    Confetti.hornSound.play();
                }, 100);
            }
        }

        this.engine.resizeCanvasToDisplaySize();
        if (clear) this.particleSystem.clear();

        this.particleSystem.config.canvasWidth = this.engine.width;
        this.particleSystem.config.canvasHeight = this.engine.height;

        const pos = this.getPosition();
        const centerX = this.engine.width / 2;
        const centerY = this.engine.height / 2;

        // Pass center position to particle system
        this.particleSystem.start(pos.x, pos.y, amount, centerX, centerY);

        if (!this.isLooping)
        {
            this.isLooping = true;
            this.engine.loop(this.draw);
        }
    }

    @bind
    private draw() {
        const ctx = this.engine.ctx;
        const canvas = this.engine.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.particleSystem.update(canvas.height);
        this.particleSystem.draw(ctx);

        if (!this.particleSystem.active)
        {
            this.isLooping = false;
            this.engine.stop();
        }
    }

    @bind
    private handleclick(e: MouseEvent) {
        if (!this.withClick) return;

        // Get the canvas element
        const canvas = this.engine.canvas;
        const rect = canvas.getBoundingClientRect();

        // Calculate relative position accounting for scroll and canvas scale
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Get position relative to canvas (accounting for scroll)
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Clamp to canvas bounds
        this.x = Math.max(0, Math.min(canvas.width, x));
        this.y = Math.max(0, Math.min(canvas.height, y));

        this.start();
    }

    @bind
    private handleControlClick() {
        this.start();
    }

    render() {
        return html`
            <canvas @click="${this.handleclick}">Your browser lacks support for html canvas - loooooooser</canvas>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-confetti": Confetti;
    }
}