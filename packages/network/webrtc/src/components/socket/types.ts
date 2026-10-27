export type SocketOptions = {
  protocols?: string | string[];
  /** Reconnect attempts before giving up for good. Default: no limit. */
  attempts?: number;
  /** ms without a connection (from the start, or since it dropped) before giving up for good. Default: no limit. */
  timeout?: number;
}
