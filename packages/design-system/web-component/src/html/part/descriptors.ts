import { PartDescriptor } from "./types";

/**
 * @fileoverview Extracts "part descriptors" from a DOM element tree.
 *
 * @details
 * A part descriptor is metadata that describes a dynamic section
 * of the DOM (e.g. a value placeholder, a list placeholder, a dynamic
 * attribute, or an event binding). These are later turned into `Part`
 * objects by the `partFactory` inside `TemplateInstance`.
 *
 * @param {Node} root - The root DOM element of the rendered template.
 * @returns {PartDescriptor[]} An array of descriptors representing dynamic
 * parts of the template.
 * 
 * @created 2025-08-11
 * @author Henry
 */
export function getDescriptors(root: Node): PartDescriptor[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
  let node: Node | null;

  if (root instanceof DocumentFragment)
    node = walker.nextNode();
  else
    node = walker.currentNode;

  const descriptors: PartDescriptor[] = [];

  while (node) 
  {
    if (node.nodeType === Node.COMMENT_NODE) 
    {
      if (node.nodeValue === 'list-marker') descriptors.push({ kind: 'list', marker: node as Comment });
      else if (node.nodeValue === 'marker') descriptors.push({ kind: 'value', marker: node as Comment });
    }
    else if (node.nodeType === Node.ELEMENT_NODE) 
    {
      const el = node as Element;

      for (const attr of Array.from(el.attributes)) 
      {
        // Example::<option ${sel && "selected"} /> 
        if (/marker-standalone-(\d)+/.test(attr.name)) 
        {
          el.removeAttribute(attr.name);
          descriptors.push({ kind: 'attr', element: el, name: attr.name, strings: [''], standalone: true });
        }
        else if (/__marker__/.test(attr.value)) 
        {
          const eventMatch = attr.name.match(/^(on|@)(?<name>.*)/);
          if (eventMatch) 
          {
            el.removeAttribute(attr.name);
            descriptors.push({ kind: 'event', element: el, name: eventMatch.groups?.name! });
          }
          else
          {
            const strings = attr.value.split("__marker__").filter(Boolean);
            if (attr.name === "key")
            {
              el.removeAttribute("key");
            }
            descriptors.push({ kind: 'attr', element: el, name: attr.name, strings: strings.length > 0 ? strings : [''] });
          }
        }
      }
    }
    node = walker.nextNode();
  }

  return descriptors;
}
