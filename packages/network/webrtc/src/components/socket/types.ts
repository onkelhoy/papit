export type SocketMessageType = "handshake" | "socket" | "network";

export type SocketMessage =
  | ConnectedMessage
  | ErrorMessage;

type ErrorMessage = {
  type: "error";
  error: string;
}
type ConnectedMessage = {
  type: "connected";
  id: string;
};