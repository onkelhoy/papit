export type EmitterEvent = {
  type: string;
  message: string;
  payload: any;
}

export type Settings = {
  logLevel?: "verbose" | "debug" | "error";
}