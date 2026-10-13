// Input rules for the first-run setup page. Pure on purpose: the endpoint and
// the form both depend on these, and they're the part worth testing.

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

export interface SetupInput {
  email: string;
  password: string;
  confirmPassword: string;
  siteName: string;
  domain: string;
  theme: string;
  createHomePage: boolean;
  setupToken: string;
}

export interface SetupValue {
  email: string;
  password: string;
  siteName: string;
  domain: string;
  theme: string;
  createHomePage: boolean;
  setupToken: string;
}

export type SetupErrors = Partial<Record<keyof SetupInput, string>>;

/** `https://News.Example.org:8080/path` becomes `news.example.org`. A site is matched by hostname only. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
}

const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateSetup(
  body: unknown,
  themes: string[],
): { ok: true; value: SetupValue } | { ok: false; errors: SetupErrors } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = str(b.email).trim().toLowerCase();
  const password = str(b.password);
  const confirmPassword = str(b.confirmPassword);
  const siteName = str(b.siteName).trim();
  const domain = normalizeDomain(str(b.domain));
  const theme = str(b.theme);
  const createHomePage = b.createHomePage !== false;
  const setupToken = str(b.setupToken);

  const errors: SetupErrors = {};

  if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  } else if (password.toLowerCase() === email) {
    errors.password = "The password can't be your email address.";
  }
  if (!errors.password && password !== confirmPassword) {
    errors.confirmPassword = "The two passwords don't match.";
  }

  if (!siteName) errors.siteName = "Give the site a name.";
  else if (siteName.length > 100) errors.siteName = "Use 100 characters or fewer.";

  if (!domain || !HOSTNAME.test(domain)) {
    errors.domain = "Enter the site's domain, for example news.example.org.";
  }

  if (!themes.includes(theme)) errors.theme = "Choose one of the available themes.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password, siteName, domain, theme, createHomePage, setupToken } };
}
