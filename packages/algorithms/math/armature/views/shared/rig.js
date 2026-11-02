import { GameObject } from "@papit/game-engine";

export const BONE = "#6e8fd8";
export const JOINT = "#d8896e";
export const HANDLE = "#4fb286";

/** A GameObject that holds an armature and draws it as lines, so all three rules of the
 *  package show here: the rig sits in object space, and the object places it in the world. */
export class Rig extends GameObject {
    constructor(armature) {
        super();
        this.armature = armature;
        this.thickness = 6;
    }

    render({ ctx }) {
        ctx.lineCap = "round";
        for (const bone of this.armature.bones)
        {
            ctx.strokeStyle = BONE;
            ctx.lineWidth = this.thickness;
            ctx.beginPath();
            ctx.moveTo(bone.head.x, bone.head.y);
            ctx.lineTo(bone.tail.x, bone.tail.y);
            ctx.stroke();

            ctx.fillStyle = JOINT;
            ctx.beginPath();
            ctx.arc(bone.head.x, bone.head.y, this.thickness, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/** A circle you can drag. `x` and `y` are canvas pixels. */
export class Handle extends GameObject {
    constructor(x, y, color = HANDLE) {
        super();
        this.position.x = x;
        this.position.y = y;
        this.color = color;
    }

    render({ ctx }) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Lets the pointer drag any of these handles around the canvas. `held()` says which one has it. */
export function draggable(canvas, handles) {
    let held = null;

    const point = event => {
        const box = canvas.getBoundingClientRect();
        return [
            (event.clientX - box.left) * canvas.width / box.width,
            (event.clientY - box.top) * canvas.height / box.height,
        ];
    };

    canvas.addEventListener("pointerdown", event => {
        const [x, y] = point(event);
        held = handles.find(({ position }) => Math.hypot(position.x - x, position.y - y) < 32) ?? null;
        if (held) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
        if (!held) return;
        [held.position.x, held.position.y] = point(event);
    });
    canvas.addEventListener("pointerup", () => held = null);

    return { held: () => held };
}
