import { Resolvable } from "./types";

export async function resolve<T>(value: Resolvable<T>): Promise<T> {
  if (value instanceof Function)
    return await value();

  return await value;
}