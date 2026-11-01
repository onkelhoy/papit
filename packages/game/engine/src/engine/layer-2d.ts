import { Matrix4 } from "@papit/matrix";

import { multiplyInto } from "../components/transform/matrix";
import { Layer } from "./layer";
import { StandardSetting } from "../types";

/** One 2D canvas. */
export class Layer2D extends Layer<CanvasRenderingContext2D> {
    private view = new Matrix4();
    private placed = new Matrix4();

    constructor(setting: StandardSetting, name: string) {
        super(setting, name);
    }

    get ctx() {
        return this.context;
    }

    override place(matrix: Float32Array, frame: number) {
        super.place(matrix, frame);

        let m = matrix;
        if (this.camera)
        {
            multiplyInto(this.placed, this.view, matrix);
            m = this.placed;
        }
        this.context.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
    }

    override finish() {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
    }

    protected prepare() {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.width, this.height);
        if (this.camera) this.updateView(this.camera.viewMatrix, this.camera.zoom);
    }

    /** `center of the canvas * zoom * camera view`. */
    private updateView(view: Float32Array, zoom: number) {
        this.view.set(view);
        for (let column = 0; column < 4; column++)
        {
            this.view[column * 4] *= zoom;
            this.view[column * 4 + 1] *= zoom;
        }
        this.view[12] += this.width / 2;
        this.view[13] += this.height / 2;
    }
}
