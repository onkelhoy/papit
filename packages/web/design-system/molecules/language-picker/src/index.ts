import { LanguagePicker } from './component.js';

// export 
export * from "./component";
export * from "./types";

// Register the element with the browser

if (!window.customElements) {
  throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-language-picker')) {
  window.customElements.define('pap-language-picker', LanguagePicker);
}
