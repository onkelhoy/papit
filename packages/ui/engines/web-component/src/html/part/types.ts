export type PartDescriptor =
  | { kind: 'value', marker: Comment }
  | { kind: 'list', marker: Comment }
  | { kind: 'nested', marker: Comment }
  | { kind: 'attr', element: Element, name: string, strings: string[], standalone?: boolean }
  | { kind: 'event', element: Element, name: string };

export interface Part {
  apply(newValue: any, oldValue?: any): void;
  clear(): void;
  remove(): void;
}

export type PartFactory = (desc: PartDescriptor, helpers: PartHelpers) => Part;

export type PartHelpers = {
  createPart: (desc: PartDescriptor) => Part;
  createTemplateInstance: (rootElement: Element | DocumentFragment) => ITemplateInstance;
};

export interface ITemplateInstance {
  update(values: any[]): void;
  remove(): void;
}