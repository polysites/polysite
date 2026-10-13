// `t("form.thanks", "Thank you.")`: the word in this request's language, or the English written in the call. Use it for text a
// visitor reads that no editor writes. Call it in setup (or a template); it follows the language of the address.
export function useT() {
  const nuxtApp = useNuxtApp();
  const language = useSiteLanguage();
  return (key: string, fallback: string, values?: Record<string, string | number>) =>
    nuxtApp.$strings.translate(language.code.value, key, fallback, values);
}
