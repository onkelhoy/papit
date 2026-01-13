import { MetaJson } from "@papit/meta-json";
import { Meta } from "./types";

export class Message<MetaType = string, Payload = any> extends MetaJson<Meta<MetaType>, Payload> { }