/** How many canvas pixels one CSS pixel covers, they differ on a high density screen. */
export function canvasScale(canvas: HTMLCanvasElement): [x: number, y: number] {
    const { width, height } = canvas.getBoundingClientRect();
    return [width ? canvas.width / width : 1, height ? canvas.height / height : 1];
}

/** A position in the viewport as canvas pixels, the space everything is drawn in. */
export function canvasPosition(canvas: HTMLCanvasElement, clientX: number, clientY: number): [x: number, y: number] {
    const { left, top } = canvas.getBoundingClientRect();
    const [scaleX, scaleY] = canvasScale(canvas);
    return [(clientX - left) * scaleX, (clientY - top) * scaleY];
}
