import ts from "typescript";
import { jsBundle } from "@papit/bundle-js";
import { DType } from "d";

export function hello(node: ts.Node, something: ReturnType<typeof jsBundle>) {
    console.log(node, something);
}

export type A = string | B;
type B = number | boolean;

export const A:DType = "world";