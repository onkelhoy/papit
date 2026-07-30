type Setting = {
    element: HTMLCanvasElement;
    contextId: "2d" | "webgl" | "webgl2"
}

export class Canvas {
    element: HTMLCanvasElement;
    context: RenderingContext | null = null;

    constructor(setting: Partial<Setting>) {
        if (!setting.element) throw new Error("must pass an canvas element");

        this.element = setting.element;
        this.context = this.element.getContext(setting.contextId ?? "2d");
    }
}