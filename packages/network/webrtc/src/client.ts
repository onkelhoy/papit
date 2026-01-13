import { Message, MessageType } from "./components/message";
import { Network } from "./components/network";
import { Socket } from "./components/socket";
import { Settings } from "./types";

export class Client {
  private socket: Socket | null = null;
  private newtork: Network | null = null;

  constructor(
    private settings: Settings
  ) { }

  send(message: MessageType) {
    const msg = Message.Create(message.meta, message.payload);
    console.log('this message should be sent', msg);
  }

  // joinNetork(network: string, password?: string) {

  // }

  private handleError = (event: Event) => {
    console.trace("[webrtc-client] error", event);
  }
  private handleDebug = (event: Event) => {
    if (this.settings.logLevel != "debug") return;
    console.trace("[webrtc-client] debug", event);
  }

  // sokcet events & setup
  private setupSocket(url: string | URL, protocols?: string | string[] | undefined) {
    return new Promise<void>((res) => {
      if (this.socket != null) return void res();
      this.socket = new Socket(url, protocols);
      this.socket.on("connected", () => res());

      this.socket.on("handshake", this.handleHandshake);
      this.socket.on("network", this.handleNetwork);
      this.socket.on("error", this.handleError);
      this.socket.on("debug", this.handleDebug);
    });
  }
}