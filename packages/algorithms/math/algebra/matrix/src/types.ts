type Row = { row: number } | { rows: number };
type Col = { col: number } | { cols: number } | { column: number } | { columns: number };
type Pretify<T> = {
  [K in keyof T]: T[K];
} & {}

type BasicData = number | Float32Array | number[];
export type Data = BasicData | number[][];
export type MatrixObject = Pretify<Row & Col & { data: BasicData }>;
export type Value = Data | MatrixObject;