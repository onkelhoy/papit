export type MessageType<Meta = Object, Payload = Object> = {
  meta: Meta;
  payload: Payload;
}
export type BufferSource = ArrayBuffer | ArrayBufferView;