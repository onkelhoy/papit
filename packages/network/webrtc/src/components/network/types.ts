import { MessageType } from "../message";

export type Settings = {
  ttl?: number;
  hopLimit?: number;
  host: string;
  password?: string;
  limit?: number;
}

export type NetworkInternalMessage =
  | NetworkJoin
  | NetworkLeave
  | NetworkUpdate;

type NetworkJoin = MessageType<"network", {
  event: "join";
}>
type NetworkLeave = MessageType<"network", {
  event: "leave";
}>
type NetworkUpdate = MessageType<"network", {
  event: "update";
}>

export type NetworkMessage =
  | NetworkInternalMessage
  | MessageType;