export type Setting = {
  name?: string;
  attribute?: string;
  applyattribute?: boolean;
  rerender?: boolean;
  verbose?: boolean;
  update?(value: any, old: any): void;
}