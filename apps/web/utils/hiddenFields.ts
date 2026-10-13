// Values for a form's hidden fields (apps/cms/src/forms/hiddenField.ts), worked out in the
// visitor's browser when the form loads. The server treats whatever comes back as untrusted
// text and cuts it to length, so this only has to be sensible, not secure.

const MAX = 500;

export interface PageContext {
  origin: string;
  pathname: string;
  search: string;
  referrer: string;
}

/** The page address without the query string or fragment. */
export function cleanUrl(href: string): string {
  try {
    const url = new URL(href);
    return url.origin + url.pathname;
  } catch {
    return "";
  }
}

export function hiddenValue(source: string | undefined, param: string | undefined, page: PageContext): string {
  let value = "";
  if (source === "page") value = page.origin + page.pathname;
  else if (source === "referrer") value = page.referrer ? cleanUrl(page.referrer) : "";
  else if (source === "param" && param) value = new URLSearchParams(page.search).get(param) ?? "";
  // "fixed" is filled in by the server, so there is nothing to send.
  return value.trim().slice(0, MAX);
}
