export type Meta<Type = string> = {
    sender: string;
    receiver: string;  // "server" | socket id
    type: Type;
    timestamp: number;
    hops?: string[];
    ttl?: number;
    hopLimit?: number;
    relay?: string;
}


export enum SignalType {
    // client → server  (meta.receiver = "server")
    Register = 'register',
    Update = 'update',
    Connect = 'connect',
    HostTransfer = 'host-transfer',
    Disconnect = 'disconnect',

    // server → client  (meta.receiver = socket id)
    ConnectionACK = 'connection-ack',
    RegisterACK = 'register-ack',
    UpdateACK = 'update-ack',
    ConnectForward = 'connect-forward',
    TransferACK = 'transfer-ack',
    Error = 'error',
}