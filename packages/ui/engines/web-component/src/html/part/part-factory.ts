
import type { PartFactory } from './types';
import { ValuePart } from './parts/value-part';
import { AttributePart } from './parts/attribute-part';
import { EventPart } from './parts/event-part';
import { ListPart } from './parts/list-part';
import { NestedPart } from './parts/nested-part';

/**
 * Factory function that creates the correct `Part` instance
 * based on the descriptor type found in the template.
 *
 * @param {import('./types').PartDescriptor} desc - The descriptor describing the type of part to create.
 * @param {import('./types').PartHelpers} helpers - Helper functions and context used by parts.
 * @returns {import('./types').Part} The `Part` instance matching the descriptor.
 * @throws {Error} If the descriptor kind is not recognized.
 */
export const partFactory: PartFactory = (desc, helpers) => {
  switch (desc.kind)
  {
    case 'value': return new ValuePart(desc.marker, helpers);
    case 'list': return new ListPart(desc.marker, helpers);
    case 'nested': return new NestedPart(desc.marker, helpers);
    case 'attr': return new AttributePart(desc.element, desc.name, desc.strings, desc.standalone);
    case 'event': return new EventPart(desc.element, desc.name);
    default: throw new Error(`Unknown part kind: ${(desc as any).kind}`);
  }
};

