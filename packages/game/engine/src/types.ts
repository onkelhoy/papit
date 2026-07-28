export type SettingCallback = (delta: number) => void;

export type BaseSetting = {
    query: string;
    state: "running" | "paused";
    width: number;
    height: number;
    timer: null | number;
    previous: null | number;
    callbacks: SettingCallback[];
    documentElement: Document | HTMLElement | ShadowRoot;
}
export type StandardSetting = BaseSetting & {
    type: "2d"
    contextSetting?: CanvasRenderingContext2DSettings;
}
export type WebGLSetting = BaseSetting & {
    type: "webgl"
    contextSetting?: WebGLContextAttributes;
}
export type WebGL2Setting = BaseSetting & {
    type: "webgl2"
    contextSetting?: WebGLContextAttributes;
}
// export type BitmapSetting = BaseSetting & {
//   type: "bitmaprenderer"
//   contextSetting?: ImageBitmapRenderingContextSettings;
// }

export type Setting = StandardSetting | WebGLSetting | WebGL2Setting; // |BitmapSetting;

// info types 
type BaseInfo = {
    type: "standard" | "webgl";
    setting: Setting;
    element: HTMLCanvasElement;
}
export type StandardInfo = BaseInfo & {
    type: "standard";
    context: CanvasRenderingContext2D;
}

type GLInfo = BaseInfo & {
    type: "webgl";
    context: WebGLRenderingContext | WebGL2RenderingContext;
    programs: Map<string, WebGLProgram>;
}

export type InfoType = StandardInfo | GLInfo;

// web GL types 
export type ShaderSource = string | {
    url: string;
}