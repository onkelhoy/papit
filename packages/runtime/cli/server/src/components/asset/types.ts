export type Translation = {
  meta: {
    region: string;
    language: string;
  };
  [key: string]: unknown;
}

export type Translations = Record<string, Translation>;