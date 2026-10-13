// The languages Polysite knows. They are declared once, in the core, even though a fresh install offers only English:
// the database stores each language in a row keyed by one of these codes, and the list of allowed codes is part of the
// checked-in migration. Declaring them all up front means offering another language later never needs a migration.
// A site turns languages on (the i18n plugin adds that setting); nothing here makes a language appear anywhere.
export interface CatalogLanguage {
  code: string;
  /** The language's own name, as its speakers write it. */
  label: string;
  rtl?: boolean;
  /** Which languages to try, in order, before the site's default when a translation is missing. */
  fallbackLocale?: string[];
}

export const DEFAULT_LANGUAGE = "en";

export const CATALOG: CatalogLanguage[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "pt-BR", label: "Português (Brasil)", fallbackLocale: ["pt"] },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
  { code: "da", label: "Dansk" },
  { code: "nb", label: "Norsk bokmål" },
  { code: "fi", label: "Suomi" },
  { code: "pl", label: "Polski" },
  { code: "cs", label: "Čeština" },
  { code: "sk", label: "Slovenčina" },
  { code: "sl", label: "Slovenščina" },
  { code: "hr", label: "Hrvatski" },
  { code: "sr", label: "Српски" },
  { code: "hu", label: "Magyar" },
  { code: "ro", label: "Română" },
  { code: "bg", label: "Български" },
  { code: "el", label: "Ελληνικά" },
  { code: "et", label: "Eesti" },
  { code: "lv", label: "Latviešu" },
  { code: "lt", label: "Lietuvių" },
  { code: "ca", label: "Català" },
  { code: "cy", label: "Cymraeg" },
  { code: "ga", label: "Gaeilge" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "he", label: "עברית", rtl: true },
  { code: "fa", label: "فارسی", rtl: true },
  { code: "ur", label: "اردو", rtl: true },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ta", label: "தமிழ்" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ไทย" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "sw", label: "Kiswahili" },
  { code: "af", label: "Afrikaans" },
];

export const CODES = CATALOG.map((l) => l.code);

export const isKnownLanguage = (code: unknown): code is string => typeof code === "string" && CODES.includes(code);

export const languageLabel = (code: string): string => CATALOG.find((l) => l.code === code)?.label ?? code;

export const isRtl = (code: string): boolean => CATALOG.find((l) => l.code === code)?.rtl === true;

// What Payload's `localization.locales` takes.
export const payloadLocales = () =>
  CATALOG.map(({ code, label, rtl, fallbackLocale }) => ({ code, label, ...(rtl ? { rtl: true } : {}), ...(fallbackLocale ? { fallbackLocale } : {}) }));
