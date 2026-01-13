export type Setting<T extends Element> = {
  selector: string;
  load(element: T): void;
}