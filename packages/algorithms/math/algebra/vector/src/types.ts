export type VectorObject = {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  order?: string[];
} & {
  [key: string]: number; // numeric keys only for extra stuff
};
export type Value = number | number[] | Float32Array | VectorObject;