// The words on the error page (error.vue). English is written here, as for every fixed word (utils/strings.ts); a language is
// added by a dictionary with these keys. Any status other than 404 gets the "something went wrong" wording.
export type Translate = (key: string, fallback: string) => string;

export interface ErrorCopy {
  /** The heading and the browser title. */
  heading: string;
  title: string;
  detail: string;
  home: string;
  back: string;
}

export function errorCopy(statusCode: number | undefined, t: Translate): ErrorCopy {
  const common = { home: t("error.home", "Go to the home page"), back: t("error.back", "Go back") };
  if (statusCode === 404) {
    return {
      heading: t("error.notFound.heading", "We can't find that page"),
      title: t("error.notFound.title", "Page not found"),
      detail: t(
        "error.notFound.detail",
        "The page may have moved, or the address may have a typo. Let's get you back on track.",
      ),
      ...common,
    };
  }
  const heading = t("error.server.heading", "Something went wrong");
  return {
    heading,
    title: heading,
    detail: t("error.server.detail", "It's on our side, not yours. Please try again in a moment."),
    ...common,
  };
}
