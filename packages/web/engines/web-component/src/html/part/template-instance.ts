import { getDescriptors } from './descriptors';
import type { Part, PartFactory, PartHelpers, ITemplateInstance, PartDescriptor } from './types';

type Meta = {
    descriptor: PartDescriptor;
    part: Part;
}

/**
 * @fileoverview
 * Represents a single rendered template instance: a DOM tree plus its dynamic parts.
 *
 * @details
 * - Created from a root element and a `PartFactory`.
 * - Manages an ordered collection of `Part`s (attributes, events, nodes, etc.).
 * - Updates only the changed parts without re-rendering the entire template.
 * - Optimizes update order:
 *   1. Attributes/events first (ensures DOM sync before children update).
 *   2. All other parts afterward.
 *
 * @example
 * const instance = new TemplateInstance(rootElement, partFactory);
 * instance.update(valuesArray);
 *
 * // Later:
 * instance.remove(); // cleans DOM & parts
 *
 * @see Part
 * @see PartFactory
 * @see PartHelpers
 * @see getDescriptors
 * 
 * @created 2025-08-12
 * @updated 2025-08-21
 * @author Henry
 */
export class TemplateInstance implements ITemplateInstance {
    private meta: Meta[];
    private indexList: number[];
    // where each part's values start: an attribute takes one value per interpolation in it
    private offsets: number[];

    get element(): Element | null {
        if (this.root instanceof Element) return this.root;
        if (this.root instanceof DocumentFragment)
        {
            // Pick the first element child as the "representative root"
            return Array.from(this.root.childNodes).find(
                n => n.nodeType === Node.ELEMENT_NODE
            ) as Element | null;
        }
        return null;
    }

    constructor(
        private root: Element | DocumentFragment,
        private partFactory: PartFactory,
    ) {
        const descriptors = getDescriptors(root);

        const helpers: PartHelpers = {
            createPart: desc => this.partFactory(desc, helpers),
            createTemplateInstance: (el) => new TemplateInstance(el, this.partFactory),
        };

        let attributes: number[] = [];
        let events: number[] = [];
        let rest: number[] = [];

        this.meta = descriptors.map((descriptor, index) => {
            switch (descriptor.kind)
            {
                case "attr":
                    attributes.push(index);
                    break;
                case "event":
                    events.push(index);
                    break;
                default:
                    rest.push(index);
                    break;
            }

            return {
                part: this.partFactory(descriptor, helpers),
                descriptor,
            }
        });

        // apply events last - thought it didnt not solve current problem.. 
        this.indexList = [...attributes, ...events, ...rest];

        let offset = 0;
        this.offsets = descriptors.map(descriptor => {
            const start = offset;
            offset += descriptor.kind === "attr" ? descriptor.strings.length - 1 : 1;
            return start;
        });
    }

    /**
     * Updates all dynamic parts with the provided values.
     * @param values The array of values corresponding to part indices.
     */
    update(values: any[]) {
        for (const i of this.indexList) 
        {
            const offset = this.offsets[i];
            const descriptor = this.meta[i].descriptor;
            if (descriptor.kind === "attr")
            {
                const v = values.slice(offset, offset + descriptor.strings.length - 1);
                this.meta[i].part.apply(v);
            }
            else 
            {
                this.meta[i].part.apply(values[offset]);
            }
        }
    }

    remove() {
        this.meta.forEach(meta => meta.part.remove());
        this.meta = [];
        this.root.parentNode?.removeChild(this.root);
    }
}