export type RectangleObject = {
    x: number;
    y: number;
} & ({ w: number; } | { width: number; }) & ({ h: number; } | { height: number; })
