export type Meta<Type = string> = {
  sender: string;
  receiver: string;
  hops?: string[];
  ttl?: number;
  hopLimit?: number;
  relay?: string;
  type: Type;
  timestamp?: number;
}

export type MessageType<MetaType = string, Payload = any> = {
  meta: Meta<MetaType>;
  payload: Payload;
}