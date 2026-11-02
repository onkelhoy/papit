import type { Layer2D } from "./engine/layer-2d";
import type { Layer3D } from "./engine/layer-3d";

export type SettingCallback = (deltaTimeInMilliseconds: number, deltaTimeInSeconds: number) => void;

export type Theme = "light" | "dark";

export type BaseSetting = {
    /** Case-insensitive, `main` or `default` makes this the default layer. */
    name: string;
    query: string;
    global: boolean;
    width: number;
    height: number;
    callbacks: SettingCallback[];
    /** Follows the light and dark theme of the page. One layer with this on is enough. */
    theme: boolean;
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

// web GL types 
export type ShaderSource = string | {
    url: string;
}

// layers
export type LayerSelector = Partial<Setting> | string;

type LayerName<S> = S extends { name: infer Name extends string } ? Lowercase<Name> : never;
type LayerOf<S> = S extends { type: "webgl" | "webgl2" } ? Layer3D : Layer2D;

export type EngineLayers<T extends readonly LayerSelector[]> =
    { [S in T[number]as LayerName<S>]: LayerOf<S> }
    & { [position: `layer${number}`]: Layer2D | Layer3D };
