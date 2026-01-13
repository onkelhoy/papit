// TODO: im still behinvg like old solution - no test nothing done here 

import { stringifyValue } from "../../functions/value";
import { nextParent } from "../../functions/next-parent";
import { Setting } from "./types";


// import { parseValue, sameValue, stringifyValue } from "../../functions/value";
// import { Setting } from "./types";
// import { PropertyMeta } from "@element/types";

const defaultSettings: Partial<Setting> = {
  rerender: true,
  verbose: false,
};

export function context(settings: Partial<Setting>): PropertyDecorator;
export function context(target: Object, propertyKey: PropertyKey): void;

export function context(
  targetOrSettings: Object | Partial<Setting>,
  maybeKey?: PropertyKey
): void | PropertyDecorator {
  // @property — no args
  if (typeof maybeKey === "string" || typeof maybeKey === "symbol") {
    define(targetOrSettings as Object, maybeKey, {});
    return; // void → valid for this overload
  }

  // @context({...}) — with config
  const settings = targetOrSettings as Partial<Setting>;
  return function (target: Object, key: PropertyKey) {
    define(target, key, settings);
  };
}

function define(target: any, propertyKey: PropertyKey, _settings: Partial<Setting>): void {
  const privateKey = String(`__${String(propertyKey)}`);
  const settings = {
    ...defaultSettings,
    name: propertyKey,
    attribute: propertyKey,
    ..._settings,
  }


  // NOTE: this is not something we need to assign with defineProperty etc 
  // rather 
  // let parentWithContext:HTMLElement|null = null;
  // Object.defineProperty(target, propertyKey, {
  //   configurable: true,
  //   enumerable: true,
  //   get() { 
  //     const data = this[privateKey];
  //   },
  //   set(value) {
  //     let parent = nextParent(this);

  //     while (parent) {
  //       // check if parent is our selector
  //       if (settings.verbose) console.log('finding parent', parent);

  //       // NOTE we need to find the orignal parent so we need to make sure it does not have the name with "{name}_subcontext" also
  //       if (settings.name as string in parent && !(contextname in parent)) {
  //         break;
  //       }
  //       if (settings.attribute && parent.hasAttribute(settings.attribute) && !(contextname in parent)) {
  //         break;
  //       }

  //       if (settings.verbose) {
  //         console.log('did not find', settings.name, 'in', parent)
  //       }

  //       if (parent === document.documentElement) {
  //         parent = null;
  //         break;
  //       }
  //       parent = nextParent(parent);
  //     }
  //   },
  // });
}


// OLD SYSTEM
// export function Decorator(setting?: Setting) {
//   // const _options = JSON.parse(JSON.stringify(setting === undefined ? DefaultSettings : { ...DefaultSettings, ...(setting as ContextOption) }));
//   const _setting = {
//     rerender: true,
//     verbose: false,
//     ...(setting || {}),
//   }

//   return function (target: any, propertyKey: string) {
//     // assign default values 
//     if (!_setting.name) _setting.name = propertyKey;
//     if (!_setting.attribute) _setting.attribute = propertyKey;

//     // Storing original connectedCallback if it exists
//     const originalConnectedCallback = target.connectedCallback;

//     // Override the connectedCallback to set up context subscription
//     target.connectedCallback = function () {
//       const me = this;
//       const contextname = _setting.name + "_subcontext";
//       me[contextname] = true;

//       // Call original connectedCallback if it exists
//       if (originalConnectedCallback) originalConnectedCallback.call(me);

//       if (_setting.verbose) console.log("connected-callback", _setting)

//       let parent = nextParent(me) as any;

//       while (parent) {
//         // check if parent is our selector
//         if (_setting.verbose) console.log('finding parent', parent);

//         // NOTE we need to find the orignal parent so we need to make sure it does not have the name with "{name}_subcontext" also
//         if (_setting.name as string in parent && !(contextname in parent)) {
//           break;
//         }
//         if (_setting.attribute && parent.hasAttribute(_setting.attribute) && !(contextname in parent)) {
//           break;
//         }

//         if (_setting.verbose) {
//           console.log('did not find', _setting.name, 'in', parent)
//         }

//         if (parent === document.documentElement) {
//           parent = null;
//           break;
//         }
//         parent = nextParent(parent);
//       }

//       if (_setting.verbose) console.log('final parent', parent);

//       if (parent) {
//         const operation = () => {
//           if (_setting.verbose) console.log('context-update', _setting.name, _setting.attribute)

//           const old = me[_setting.name as string];
//           if (_setting.name as string in parent) {
//             me[_setting.name as string] = parent[_setting.name as string];
//           }
//           else if (_setting.attribute && parent.hasAttribute(_setting.attribute)) {
//             me[_setting.name as string] = parent.getAttribute(_setting.attribute);
//           }

//           if (_setting.applyattribute) {
//             if (me[_setting.name as string] === undefined) {
//               // TODO need to check if this would cause issues with type:boolean = true values - is value true or undefined?
//               this.removeAttribute(_setting.attribute);
//             }
//             else if (!(me[_setting.name as string] instanceof Object)) {
//               const valuestring = stringifyValue(me[_setting.name as string], String);
//               this.setAttribute(_setting.attribute, valuestring);
//             }
//           }

//           if (_setting.update) {
//             _setting.update.call(this, me[_setting.name as string], old);
//           }

//           if (_setting.rerender) {
//             me.requestUpdate();
//           }
//         }

//         // init value
//         operation();

//         // Subscribe to context changes
//         parent.addEventListener(`context-${_setting.name}`, operation);
//         // if (DEV_MODE) parent.addEventListener('context-manual-change', operation);
//         parent.addEventListener('context-manual-change-banana', operation);
//       } else {
//         console.warn(`Context provider for '${_setting.name}' not found.`);
//       }
//     }
//   }
// }