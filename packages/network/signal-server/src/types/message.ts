import { NetworkInfo } from './socket';

export enum MessageType {
  Target = "target",
}
export interface Message extends Object {
  type: any;
}
export interface TargetMessage extends Message {
  type: MessageType.Target;
  target: string;
}

// outgoing messages 
export enum OutgoingMessageType {
  Error = "error",
  ConnectionACK = "socket-connection-ack",
  RegisterACK = "network-register-ack",
  UpdateACK = "network-update-ack",
}
export interface OutgoingMessage extends Message {
  type: OutgoingMessageType | MessageType;
}

// incomming messages
export enum IncomingMessageType {
  Register = "network-register",
  Update = "network-update",
}
export interface IncomingMessage extends Message {
  type: IncomingMessageType | MessageType;
}
export interface NetworkMessage extends IncomingMessage {
  network: NetworkInfo;
}