import { Codec } from "./codec";
import { BufferSource, MessageType } from "./types";

export class MetaJson<Meta extends Object = object, Payload = any> implements MessageType<Meta, Payload | BufferSource> {
  private parsed = false;
  private binary: Uint8Array<ArrayBufferLike> | undefined = undefined;
  constructor(
    public meta: Meta,
    public payload: Payload | BufferSource,
  ) { }

  public toBinary(force?: boolean) {
    if (force) this.binary = undefined;
    if (!this.binary) this.binary = Codec.Encode<Meta, Payload | BufferSource>(this);

    return this.binary;
  }

  public parse<T extends Payload = Payload>(): T {
    if (this.parsed) return this.payload as T;
    this.parsed = true;

    let payload = this.payload;

    // Only parse if payload is a buffer type
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer || ArrayBuffer.isView(payload))
    {
      this.payload = Codec.Parse<T>(payload);
    } else
    {
      // Already parsed, just cast it
      this.payload = payload as T;
    }

    return this.payload as T;
  }

  static Create<
    This extends new (meta: any, payload: any) => MetaJson<any, any>,
    Meta extends Object = object,
    Payload = Object | string
  >(this: This, meta: Meta, payload: Payload) {
    return new this(
      {
        sender: "",
        receiver: "",
        timestamp: Date.now(),
        ...(meta),
      },
      payload,
    ) as InstanceType<This>;
  }

  static FromBinary<
    This extends new (meta: any, payload: any) => MetaJson<any, any>,
    Meta extends Object = object,
    Payload = any
  >(this: This, data: Uint8Array<ArrayBufferLike>, parsePayload?: boolean): InstanceType<This> {
    const message = Codec.Decode<Meta, Payload>(data, parsePayload);
    const msg = new this(message.meta, message.payload);
    msg.parsed = !!parsePayload;
    return msg as InstanceType<This>;
  }
}