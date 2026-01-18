export type SpawnOptions = { 
  args: string[];
  cwd: string;
  onData(text:string): void;
  onError(text:string): void; 
  onClose(code: number|null, stdout: string, stderr: string): void; 
}
export type option = {
  index: number;
  text: string;
}