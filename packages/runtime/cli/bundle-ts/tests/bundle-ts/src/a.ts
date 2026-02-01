export { B } from "./b";

import { DType } from "./d";
import { CType } from "./c";

export function A(input: CType) 
{
    return input as DType;
} 