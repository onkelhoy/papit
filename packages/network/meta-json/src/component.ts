import { Codec } from "./codec";
import type { BufferSource, MessageType } from "./types";

/**
 * A message with JSON metadata and a lazily parsed payload.
 * Decode with `FromBinary` to read `meta` without touching the payload; call `parse()` only when needed.
 */
export class MetaJson<Meta extends Object = object, Payload = any> implements MessageType<Meta, Payload | BufferSource> {
  private parsed = false;
  private binary: Uint8Array<ArrayBufferLike> | undefined = undefined;
  constructor(
    public meta: Meta,
    public payload: Payload | BufferSource,
  ) { }

  /** Encodes via `Codec.Encode`. The result is cached; pass `force` to re-encode after changing `meta` or `payload`. */
  public toBinary(force?: boolean) {
    if (force) this.binary = undefined;
    if (!this.binary) this.binary = Codec.Encode<Meta, Payload | BufferSource>(this);

    return this.binary;
  }

  /** `JSON.parse`s a binary payload once and caches it. Non-binary payloads are returned as they are. */
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

  /** Creates a message whose meta starts with `sender: ""`, `receiver: ""` and `timestamp: Date.now()`, overridden by `meta`. */
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

  /** Decodes a buffer from `toBinary` / `Codec.Encode`. Returns the subclass it is called on. */
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