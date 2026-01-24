export type SpawnOptions = {
    args: string[];
    cwd: string;
    onData(text: string): void;
    onError(error: Error, stdout: string, stderr: string): void;
    onClose(code: number | null, stdout: string, stderr: string): void;
}
export type option = {
    index: number;
    text: string;
}

export type LoadingClose = () => void;
export type LoadingUpdate = (text: string) => void;