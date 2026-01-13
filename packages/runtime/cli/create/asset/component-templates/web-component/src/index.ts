import { VARIABLE_CLASS_NAME } from './component.js';

// export 
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements) {
  throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('VARIABLE_HTML_NAME')) {
  window.customElements.define('VARIABLE_HTML_NAME', VARIABLE_CLASS_NAME);
}
