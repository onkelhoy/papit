export type PeerOptions = {
  /** Passed to `RTCPeerConnection`, e.g. `iceServers`. */
  rtc?: RTCConfiguration;
  /** ms before a handshake fails. */
  timeout?: number;
}
