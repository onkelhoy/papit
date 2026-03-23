/**
 * @fileoverview Provides a lightweight `html` tagged template function for creating
 * and caching DOM elements from template literals, with support for dynamic values
 * and metadata tracking.
 *
 * @details
 * **Features:**
 * - **Compilation & Caching** — Templates are compiled into DOM once and reused on subsequent calls.
 * - **Dynamic Value Markers** — Injects comment markers to identify and update dynamic values.
 * - **Metadata Tracking** — Associates root elements with their latest set of dynamic values.
 * - **Root Normalization** — Ensures a single Element root is always returned, wrapping as needed.
 * - **Quoting Fixes** — Automatically adds missing attribute quotes for valid HTML output.
 *
 * **Usage Flow:**
 * 1. The `html` function compiles or retrieves a cached template root.
 * 2. A clone of the root element is created for each call.
 * 3. Dynamic values are stored in an internal `WeakMap` for later updates.
 *
 * @example
 * ```ts
 * const view = html`
 *   <div class="user">${username}</div>
 * `;
 * document.body.append(view);
 *
 * const values = getValues(view); // Retrieve dynamic values array
 * ```
 *
 * @see {@link getValues} — Retrieves the stored dynamic values for a root element.
 *
 * @internal
 * This is the low-level core for the template system; higher-level rendering functions
 * may build on this to perform DOM diffing and patching.
 *
 * @created 2025-08-11
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 */

// Metadata map to associate root elements with their dynamic values
// Used to store the latest set of values applied to a rendered template
const metadataMap = new WeakMap<Node, any[]>();

// Cache storing compiled root elements per unique template literal strings array
// Prevents re-parsing and re-creating DOM for the same template literal strings
const cachedElements = new WeakMap<TemplateStringsArray, Node>();

/**
 * Parses a raw HTML string into a normalized DOM `Element`.
 *
 * @param template Raw HTML string to parse into DOM.
 * @returns Root `Element` created from the provided HTML string.
 *
 * @example
 * const el = html("<slot></slot>");
 * document.body.appendChild(el);
 */
export function html(template: string): Node;
/**
 * Creates a DOM `Element` from a tagged template literal, inserting dynamic values.
 * 
 * @param templateStringArray Template literal strings array (static parts of the HTML).
 * @param values Dynamic values to insert between the static strings.
 * @returns Root `Element` representing the compiled template DOM.
 *
 * @example
 * const el = html`<div>${content}</div>`;
 * document.body.appendChild(el);
 */
export function html(templateStringArray: TemplateStringsArray, ...values: unknown[]): Node;

export function html(templateOrStrings: string | TemplateStringsArray, ...values: unknown[]): Node {
  if (typeof templateOrStrings === "string")
  {
    const t = document.createElement("template");
    t.innerHTML = templateOrStrings;
    return normalizeRoot(t.content.cloneNode(true) as DocumentFragment);
  }

  // Compile or get cached DOM for this template string array
  const proto = compile(templateOrStrings, values);

  const root = proto.cloneNode(true);

  // mark this clone as an actual template root and attach its values
  (root as any).__isTemplateRoot = true;

  // Store the dynamic values associated with this root element
  metadataMap.set(root, values);

  return root;
}

/**
 * Compiles the template strings array into a root Element.
 * Caches the resulting Element for future calls with the same template.
 * 
 * @param templateStringArray The template literal strings array
 * @returns Root Element of the compiled template
 */
function compile(templateStringArray: TemplateStringsArray, values: unknown[]): Node {
  // Return cached root element if it exists
  if (cachedElements.has(templateStringArray))
  {
    return cachedElements.get(templateStringArray)!;
  }

  // Create a <template> element for safe HTML parsing
  const template = document.createElement('template');

  // This flag helps fix attribute quoting issues by adding quotes where needed
  let expectQuote = false;
  let insideTag = false;

  // Join template strings inserting comment markers to mark dynamic parts
  let result = '';
  for (let i = 0; i < templateStringArray.length; i++)
  {
    let fixedStr = templateStringArray[i];

    // Determine if we're entering or exiting a tag
    if (fixedStr.lastIndexOf('<') > fixedStr.lastIndexOf('>')) insideTag = true;
    if (fixedStr.lastIndexOf('>') > fixedStr.lastIndexOf('<')) insideTag = false;

    // If last string ended with '=', ensure next string starts with '"'
    if (expectQuote)
    {
      if (!fixedStr.startsWith('"')) fixedStr = '"' + fixedStr;
      expectQuote = false;
    }

    // If current string ends with '=', prepare to add opening quote next time
    if (fixedStr.endsWith('='))
    {
      fixedStr += '"';
      expectQuote = true;
    }

    result += fixedStr;

    // guess this case should not happend but just for sanity 
    if (i >= values.length) continue;

    const val = values[i];

    if (insideTag)
    {
      if (/='?"?$/.test(fixedStr))
        result += '__marker__';
      else
        result += `marker-standalone-${i}="${i}"`;
    }
    else
    {
      // Regular DOM content: use comment markers
      result += Array.isArray(val) ? '<!--list-marker-->' : '<!--marker-->';
    }
  }

  template.innerHTML = result;

  // Clone content from the template element to create a DocumentFragment
  const fragment = template.content.cloneNode(true) as DocumentFragment;

  // Normalize the fragment into a root Element (unwraps single node or wraps multiple in a div)
  const root = normalizeRoot(fragment);

  // Cache the compiled root element for reuse
  cachedElements.set(templateStringArray, root);

  return root;
}

/**
 * Retrieves the stored dynamic values metadata associated with a root element.
 * 
 * @param element Root element created by `html` function
 * @returns Array of dynamic values or undefined if none stored
 */
export function getValues(node: Node) {
  return metadataMap.get(node);
}

/**
 * Checks if a text node is empty or contains only whitespace.
 * 
 * @param node The node to check
 * @returns True if the node is a text node and empty/whitespace only
 */
function isNotEmptyTextNode(node: Node): boolean {
  return !(
    node.nodeType === Node.TEXT_NODE &&
    !/\S/.test(node.textContent || '')
  );
}

/**
 * Normalizes a DocumentFragment into a single root Element.
 * - If no children or only empty text nodes: returns an empty <div>
 * - If exactly one child node:
 *    - If element node, returns it directly
 *    - Otherwise wraps it in a <div>
 * - If multiple child nodes, wraps them in a <div>
 * 
 * This ensures the template always returns an Element as root.
 * 
 * @param fragment DocumentFragment containing template content
 * @returns Root Element for the template
 */

function normalizeRoot(fragment: DocumentFragment): Node {
  const filtered = Array.from(fragment.childNodes).filter(isNotEmptyTextNode);

  if (filtered.length === 0) return document.createDocumentFragment();
  if (filtered.length === 1) return filtered[0];

  // Return a DocumentFragment with multiple children (do not wrap in div)
  const wrapper = document.createDocumentFragment();
  filtered.forEach(node => wrapper.appendChild(node));
  return wrapper;
}
