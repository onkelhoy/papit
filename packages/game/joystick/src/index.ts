import { Joystick } from './component.js';

// export 
export * from "./component";
export * from "./types";
export * from "./components/joystick-button";

// Register the element with the browser

if (!window.customElements) {
  throw new Error('Custom Elements not supported');
}

if (!window.customElements.get('pap-joystick')) {
  window.customElements.define('pap-joystick', Joystick);
}
