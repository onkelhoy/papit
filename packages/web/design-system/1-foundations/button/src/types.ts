/**
 * Theme color of a `pap-button`.
 * `"tiertery"` is a deprecated misspelling of `"tertiary"`, kept as an alias.
 */
export type ButtonColor =
    | "primary"
    | "secondary"
    | "tertiary"
    /** @deprecated use `"tertiary"` */
    | "tiertery"
    | "success"
    | "warning"
    | "error"
    | "information";
