/** A message as two parts: JSON metadata and a payload. */
export type MessageType<Meta = Object, Payload = Object> = {
  meta: Meta;
  payload: Payload;
}
/** Any binary input the codec accepts. */
export type BufferSource = ArrayBuffer | ArrayBufferView;