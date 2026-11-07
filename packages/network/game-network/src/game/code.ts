/** No 0/O, 1/I/L: a code is read out loud and typed too. */
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
/** The query parameter an invite link carries the code in. */
export const INVITE_PARAM = "g";

/** A new game code, like `K7QF2M`. */
export function newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    return [...bytes].map(byte => LETTERS[byte % LETTERS.length]).join("");
}

/** The code tidied up (`k7qf-2m` → `K7QF2M`), or "" when it isn't one. */
export function cleanCode(text: string | null | undefined) {
    const code = String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return code.length === CODE_LENGTH && [...code].every(char => LETTERS.includes(char)) ? code : "";
}

/** The game network's id for a code: same code, same network, so a reopened game keeps its link. */
export const gameId = (app: string, code: string) => `${app}-game-${code}`;

/** The link to hand out (URL or QR). Whatever else is in the address stays. */
export function inviteLink(code: string, page: string = location.href) {
    const url = new URL(page);
    url.hash = "";
    url.searchParams.set(INVITE_PARAM, code);
    return url.toString();
}

/** The code in a page's query, "" when there is none. */
export function parseInvite(search: string = location.search) {
    return cleanCode(new URLSearchParams(search).get(INVITE_PARAM));
}

/** The page without an invite in it. */
export function withoutInvite(page: string = location.href) {
    const url = new URL(page);
    url.searchParams.delete(INVITE_PARAM);
    url.hash = "";
    return url.toString();
}
