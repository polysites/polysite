// The fixed words a visitor reads that no editor writes: "Read more", "Thank you", form messages. The English text lives in the code
// that uses it, so nothing is needed for English; a language is added by registering a dictionary for it (a theme or a plugin
// does that from its own Nuxt plugin). A word with no translation shows the English, never a key or a blank.
export type Dictionary = Record<string, string>;

export interface StringRegistry {
  register: (code: string, dictionary: Dictionary) => void;
  translate: (code: string, key: string, fallback: string, values?: Record<string, string | number>) => string;
}

const fill = (text: string, values?: Record<string, string | number>): string =>
  values ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : text;

export function createStringRegistry(): StringRegistry {
  const books = new Map<string, Dictionary>();
  return {
    register(code, dictionary) {
      books.set(code, { ...books.get(code), ...dictionary });
    },
    translate(code, key, fallback, values) {
      // "pt-BR" tries its own words first, then "pt".
      const base = code.split("-")[0]!;
      const found = books.get(code)?.[key] ?? (base !== code ? books.get(base)?.[key] : undefined);
      return fill(found ?? fallback, values);
    },
  };
}
