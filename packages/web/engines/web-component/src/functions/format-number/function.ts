/**
 * @fileoverview Formats numbers into compact, human-readable strings with unit suffixes.
 *
 * @details
 * - Uses `Intl.NumberFormat` with default options from {@link STANDARD_OPTIONS}.
 * - Supports compact notation such as `"1.3K"`, `"2.3M"`, `"7.8B"`, `"1.2T"`.
 * - Caches formatters internally for better performance on repeated calls with the same
 *   locale and options.
 * 
 * @remarks
 * This function caches `Intl.NumberFormat` instances based on the `locale` and `options`
 * combination. This improves performance but means:
 * - You will get the same formatter instance on subsequent calls with the same arguments.
 * - Changing `STANDARD_OPTIONS` at runtime will not affect already cached formatters.
 *
 * 
 * @see {@link STANDARD_OPTIONS} for default compact number formatting settings.
 *
 * @author
 * Henry Pap (GitHub: @onkelhoy)
 * @created 2025-08-13
 */

import { STANDARD_OPTIONS } from "./constants";

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, options?: Intl.NumberFormatOptions) {
  const key = `${locale}::${JSON.stringify(options || {})}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, {
      ...STANDARD_OPTIONS,
      ...options
    }));
  }
  return formatterCache.get(key)!;
}

/**
 * Formats a number into a compact, human-readable string with unit suffixes.
 *
 * @param value - The number to format.
 * @param locale - BCP 47 language tag (default: `"en-US"`).
 * @param options - Optional `Intl.NumberFormatOptions` overrides.
 * @returns The formatted string.
 *
 * @example
 * ```ts
 * FormatNumber(1250);                 // "1.3K"
 * FormatNumber(1250, "sv-SE");        // "1,3 tn"
 * FormatNumber(2_300_000, "en-GB");   // "2.3M"
 * ```
 */
export function FormatNumber(
  value: number,
  locale = "en-US",
  options?: Intl.NumberFormatOptions
): string {
  return getFormatter(locale, options).format(value);
}
