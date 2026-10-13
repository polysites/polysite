import { directionOf, languageQuery, SINGLE_LANGUAGE, splitLanguage, withLanguage, type LanguageSetup } from "../utils/language";

// The language of this request. The site's offer (which languages, which is the default) is filled in once per request by
// useSite(); the language itself is read from the address, so it follows the visitor around the site. A site with one
// language (every site without the i18n plugin) always answers "English, no prefix", and nothing below changes a link or a query.
export const useLanguageSetup = () => useState<LanguageSetup>("polysite-language-setup", () => SINGLE_LANGUAGE);

export function useSiteLanguage() {
  const setup = useLanguageSetup();
  const route = useRoute();
  const parts = computed(() => splitLanguage(route.path, setup.value));
  const code = computed(() => parts.value.code);
  return {
    setup,
    /** The language of this address. */
    code,
    /** The address without its language ("about", "" for the home page). */
    path: computed(() => parts.value.rest),
    defaultCode: computed(() => setup.value.default),
    languages: computed(() => setup.value.languages),
    multilingual: computed(() => setup.value.languages.length > 1),
    dir: computed(() => directionOf(code.value)),
    /** An internal address in this request's language. */
    localePath: (href: string) => withLanguage(href, code.value, setup.value),
    /** What to add to a Payload request to get this language, with the site's default as the fallback. */
    query: () => languageQuery(code.value, setup.value),
  };
}

export const useLocalePath = () => useSiteLanguage().localePath;
