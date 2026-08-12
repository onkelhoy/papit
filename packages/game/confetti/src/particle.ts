interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    color: string;
    life: number;
    maxLife: number;
    gravity: number;
    shape: 'rect' | 'triangle' | 'circle';
    width: number;
    height: number;
    points?: { x: number, y: number }[];
    // New properties for pipe effect
    spreadDelay?: number;
    initialVx?: number;
    initialVy?: number;
    spreadAmount?: number;
}

interface ParticleSystemConfig {
    colors?: string[];
    gravity?: number;
    particleCount?: number;
    speedMin?: number;
    speedMax?: number;
    sizeMin?: number;
    sizeMax?: number;
    spread?: number; // How wide the burst spreads
    upwardBias?: number; // How much upward force
    canvasWidth?: number;
    canvasHeight?: number;
}

export class ParticleSystem {
    private particles: Particle[] = [];
    public config: Required<ParticleSystemConfig>;
    private defaultColors = [
        '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
        '#FF6BD6', '#FF9F43', '#00D2D3', '#F368E0',
        '#FFC312', '#C4E538', '#FDA7DF', '#ED4C67',
        '#FF4757', '#2ED573', '#1E90FF', '#FF6348'
    ];
    private isActive = false;

    constructor(config: ParticleSystemConfig = {}) {
        this.config = {
            colors: config.colors || this.defaultColors,
            gravity: config.gravity || 0.12,
            particleCount: config.particleCount || 200,
            speedMin: config.speedMin || 3,
            speedMax: config.speedMax || 14,
            sizeMin: config.sizeMin || 4,
            sizeMax: config.sizeMax || 16,
            spread: config.spread || Math.PI * 1.8,
            upwardBias: config.upwardBias || 0.7,
            canvasWidth: config.canvasWidth || 400,
            canvasHeight: config.canvasHeight || 400,
        };
    }

    private getRandomColor(): string {
        const colors = this.config.colors;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private getRandomShape(): 'rect' | 'triangle' | 'circle' {
        const shapes: ('rect' | 'triangle' | 'circle')[] = ['rect', 'rect', 'triangle', 'triangle', 'circle'];
        return shapes[Math.floor(Math.random() * shapes.length)];
    }

    private getTrianglePoints(size: number): { x: number, y: number }[] {
        // Equilateral triangle
        const height = size * 0.9;
        const halfWidth = size * 0.5;
        return [
            { x: 0, y: -height / 2 },
            { x: -halfWidth, y: height / 2 },
            { x: halfWidth, y: height / 2 }
        ];
    }
    start(x: number, y: number, count?: number, centerX?: number, centerY?: number) {
        const particleCount = count || this.config.particleCount;
        const { speedMin, speedMax, sizeMin, sizeMax, gravity, spread, upwardBias } = this.config;

        const cx = centerX || x;
        const cy = centerY || y;

        // Calculate distance from center
        const dx = cx - x;
        const dy = cy - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if we're below center
        const isBelowCenter = y > cy;

        // Define the inner circle radius - 70% of canvas
        const canvasSize = Math.min(
            this.config.canvasWidth || 400,
            this.config.canvasHeight || 400
        );
        const innerRadius = canvasSize * 0.7;

        // Calculate blend factor: 0 = at center (full explosion), 1 = far from center (toward center)
        let blendFactor = Math.min(1, distance / innerRadius);
        blendFactor = Math.pow(blendFactor, 1.5);

        for (let i = 0; i < particleCount; i++)
        {
            let finalAngle: number;

            // Calculate the spread based on blend factor
            const maxSpread = Math.PI * 2; // Full circle
            const minSpread = Math.PI * 0.3; // Tight spread
            const currentSpread = maxSpread - (maxSpread - minSpread) * blendFactor;

            // Direction toward center
            let angleToCenter = Math.atan2(dy, dx);

            // If below center, add upward bias
            if (isBelowCenter)
            {
                // Add slight upward bias (PI/2 = straight up)
                const upBias = 0.15 + (1 - blendFactor) * 0.15; // More bias near center
                const upAngle = -Math.PI / 2; // Straight up
                angleToCenter = angleToCenter + (upAngle - angleToCenter) * upBias * 0.3;
            }

            // Add spread around the direction
            const spreadAngle = (Math.random() - 0.5) * currentSpread;
            finalAngle = angleToCenter + spreadAngle;

            const speed = Math.random() * (speedMax - speedMin) + speedMin;
            const size = Math.random() * (sizeMax - sizeMin) + sizeMin;
            const shape = this.getRandomShape();

            // Speed: more uniform across the canvas
            const speedScale = 0.6 + 0.4 * (1 - blendFactor * 0.3);

            let vx = Math.cos(finalAngle) * speed * speedScale * (0.5 + Math.random() * 0.5);
            let vy = Math.sin(finalAngle) * speed * speedScale * (0.5 + Math.random() * 0.5);

            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: vx,
                vy: vy,
                size: size,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.5,
                color: this.getRandomColor(),
                life: 1,
                maxLife: Math.random() * 130 + 90,
                gravity: gravity * (0.7 + Math.random() * 0.3),
                shape: shape,
                width: size * (0.4 + Math.random() * 0.6),
                height: size * (0.4 + Math.random() * 0.6),
                points: shape === 'triangle' ? this.getTrianglePoints(size) : undefined,
            });
        }

        this.isActive = true;
    }


    update(canvasHeight: number) {
        if (!this.isActive) return;

        for (let i = this.particles.length - 1; i >= 0; i--)
        {
            const p = this.particles[i];

            // Update physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.995; // Slight air resistance
            p.rotation += p.rotationSpeed;
            p.life -= 1 / p.maxLife;

            // Add some wind/chaos
            p.vx += (Math.random() - 0.5) * 0.05;

            // Remove dead particles or ones that fall off screen
            if (p.life <= 0 || p.y > canvasHeight + 50 || p.x < -50 || p.x > canvasHeight + 50)
            {
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }

        if (this.particles.length === 0)
        {
            this.isActive = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.isActive || this.particles.length === 0) return;

        for (const p of this.particles)
        {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            const alpha = Math.max(0, p.life);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;

            // Add slight shadow for depth
            // ctx.shadowColor = 'rgba(0,0,0,0.1)';
            // ctx.shadowBlur = 2;

            if (p.shape === 'rect')
            {
                // Rectangle with slight rounding for realism
                const w = p.width;
                const h = p.height;
                ctx.beginPath();
                ctx.roundRect(-w / 2, -h / 2, w, h, 1);
                ctx.fill();
            } else if (p.shape === 'triangle')
            {
                // Draw triangle
                ctx.beginPath();
                if (p.points)
                {
                    ctx.moveTo(p.points[0].x, p.points[0].y);
                    for (let j = 1; j < p.points.length; j++)
                    {
                        ctx.lineTo(p.points[j].x, p.points[j].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            } else
            {
                // Circle
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    clear() {
        this.particles = [];
        this.isActive = false;
    }

    get particleCount() {
        return this.particles.length;
    }

    get active() {
        return this.isActive;
    }
}

// Add roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect)
{
    CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number, r: number) {
        if (r > w / 2) r = w / 2;
        if (r > h / 2) r = h / 2;
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        return this;
    };
}