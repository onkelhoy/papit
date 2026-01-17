import { Data, Value, MatrixObject } from "./types";

export function isNestedArray(v: unknown): v is number[][] {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
}
export function isMatrixObject(v: unknown): v is MatrixObject {
  return v !== null && typeof v === "object" && "data" in v;
}

function extractFromMatrixObject(matrix: MatrixObject): { rows: number; cols: number; data: Data } {
  return {
    rows: 'row' in matrix ? matrix.row : matrix.rows,
    cols: 'col' in matrix ? matrix.col : 'cols' in matrix ? matrix.cols : 'column' in matrix ? matrix.column : matrix.columns,
    data: matrix.data,
  }
}
export function toMatrix(value: Value, _rows?: number, _cols?: number): { rows: number; cols: number; data: number[] | Float32Array } {
  let cols = _cols ?? 0;
  let rows = _rows ?? 0;

  // case: object 
  if (isMatrixObject(value))
  {
    // we are column-major but clearly user knows what they are doing 
    const extracted = extractFromMatrixObject(value);
    rows = extracted.rows;
    cols = extracted.cols;

    value = extracted.data;
  }

  // Case: Float32Array 
  if (ArrayBuffer.isView(value))
  {
    // we SWAP as we are column-major 
    return {
      rows: rows || value.length,
      cols: cols || 1,
      data: value,
    }
  }

  // Case: Array 
  if (Array.isArray(value))
  {

    /*
      remember, we are column-major, we take input thats normally in row-major and thus we swap 

      input -> [[1,2,3], [4,5,6]]
      yields -> rows = 3 [[1,4], [2,5], [3,6]]
             -> cols = 2 [[1,2,3], [4,5,6]]
    */
    if (isNestedArray(value))
    {
      const rows = value.length;
      const cols = value[0].length;
      const data = new Float32Array(rows * cols);

      for (let c = 0; c < cols; c++)
      {
        for (let r = 0; r < rows; r++)
        {
          data[c * rows + r] = value[r][c];
        }
      }

      return { rows, cols, data, };
    }

    return {
      rows: rows || value.length,
      cols: cols || 1,
      data: value,
    };
  }

  // Case: Scalar
  return {
    rows: rows || 1,
    cols: cols || 1,
    data: new Array(rows * cols).fill(value),
  }
}