import { Emitter } from "../../emitter";
import { MessageType } from "../message";
import { NetworkMessage, Settings, NetworkInternalMessage } from "./types";

export class Network extends Emitter {
  private hopLimit: number = 10;
  private ttl: number = 1; // this gets updated on each join + leave event 

  constructor(
    private readonly settings: Settings,
    private readonly id: string,
  ) {
    super();

    if (this.settings.ttl) this.ttl = this.settings.ttl;
    if (this.settings.hopLimit) this.hopLimit = this.settings.hopLimit;
  }

  public send(message: MessageType) {
    if (message.meta.receiver === this.id)
    {
      return void this.emit("message", message);
    }

    message.meta.hops ??= [];
    message.meta.ttl ??= this.ttl ?? 10;
    message.meta.hopLimit ??= this.hopLimit;

    // record this peer as a relay
    if (!message.meta.hops.includes(this.id))
    {
      message.meta.hops.push(this.id);
    }
    else 
    {
      message.meta.hopLimit--;
    }

    message.meta.ttl--;

    if (message.meta.ttl <= 0 || message.meta.hopLimit <= 0)
    {
      this.emit("drop", message);
      return;
    }

    if (this.isInternalMessage(message))
    {
      return void this.handleInternalMessage(message);
    }

    // const relay = this.topology.route(message.receiver);

    // if (!relay) {
    //   this.dispatchEvent(new CustomEvent("network-unreachable", { detail: message }));
    //   return;
    // }

    // this.dispatchEvent(
    //   new CustomEvent("network-forward", {
    //     detail: { to: nextHop, message: { ...message, ttl: message.ttl - 1 } }
    //   })
    // );

    // this.dispatchEvent(new CustomEvent("relay", {
    //   detail: {
    //     ...message,
    //     relay: message.receiver, // TODO: change later so topology will give us this one. 
    //   }
    // }))
  }

  private isInternalMessage(message: NetworkMessage): message is NetworkInternalMessage {
    return message.meta.type === "network";
  }


  private handleInternalMessage(message: NetworkInternalMessage) {
    switch (message.payload.event)
    {
      case "join":
        this.hopLimit++;
        break;
      case "leave":
        this.hopLimit--;
        break;
      case "update":
        break;
      default:
        this.error("network-event", "invalid type", message);
        break;
    }
  }
}