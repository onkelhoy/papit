/** One language as the picker shows it. */
export type LanguageOption = {
    id: string;
    /** Display name in the current language, e.g. "Swedish". */
    name: string;
    /** Two-letter region for the flag, e.g. "SE". */
    region?: string;
};
