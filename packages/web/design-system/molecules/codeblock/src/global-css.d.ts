declare module "*.css" {
    const sheet: CSSStyleSheet;
    export default sheet;
}

declare module "https://esm.sh/highlight.js" {
    export { default } from "highlight.js";
}