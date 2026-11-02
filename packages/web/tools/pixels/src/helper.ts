/** Resolves with the image once it has loaded. */
export function LoadImage(src: string): Promise<HTMLImageElement> {
    return new Promise(res => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            res(img);
        }
    });
}
