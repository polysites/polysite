// Settings that are fine on a laptop and not on a public server. Pure functions of the environment, so each rule is tested.
type Env = Record<string, string | undefined>;

/** Whether this install is served over https (the CMS and the sites both answer to real domains). */
export function isPublicDeployment(env: Env = process.env): boolean {
  return env.CMS_SCHEME === "https" || env.SITE_SCHEME === "https";
}

/** The session cookie's flags: `Secure` whenever the admin is served over https, so a downgraded plain-http request never carries it. */
export function authCookies(env: Env = process.env): { secure: boolean; sameSite: "Lax" } {
  return { secure: env.CMS_SCHEME === "https", sameSite: "Lax" };
}

// The values .env.example ships with, and what a quick "make it work" tends to leave behind.
const PLACEHOLDER = /(^|[-_ ])(changeme|change-me|example|placeholder|password)([-_ ]|$)/i;
const MIN_SECRET_LENGTH = 32;

/** Why a secret is not fit for a public server, or null when it is. */
export function weakSecretReason(name: string, value: string | undefined): string | null {
  if (!value) return `${name} is not set`;
  if (PLACEHOLDER.test(value)) return `${name} still has a placeholder value (copied from .env.example?)`;
  if (value.length < MIN_SECRET_LENGTH) return `${name} is shorter than ${MIN_SECRET_LENGTH} characters`;
  return null;
}

const CHECKED = ["PAYLOAD_SECRET", "REVALIDATE_SECRET", "NUXT_REVALIDATE_SECRET", "POSTGRES_PASSWORD"] as const;

/**
 * The problems that must stop a server which is reachable on the internet (served over https) from starting. On plain http
 * (local development, the fresh-install smoke test) nothing is checked. REVALIDATE_SECRET, NUXT_REVALIDATE_SECRET and
 * POSTGRES_PASSWORD are checked only where set: they are not all present in every deployment (a managed database has no
 * POSTGRES_PASSWORD).
 */
export function productionProblems(env: Env = process.env): string[] {
  if (!isPublicDeployment(env)) return [];
  const problems: string[] = [];
  for (const name of CHECKED) {
    if (name !== "PAYLOAD_SECRET" && env[name] === undefined) continue;
    const reason = weakSecretReason(name, env[name]);
    if (reason) problems.push(reason);
  }
  if (!env.CMS_DOMAIN) problems.push("CMS_DOMAIN is not set (sign-in links and the cross-site request check need the admin's address)");
  return problems;
}

/** Throws, naming every problem, unless POLYSITE_ALLOW_WEAK_SECRETS=1 (an escape hatch for a staging server). */
export function assertProductionSafe(env: Env = process.env): void {
  if (env.POLYSITE_ALLOW_WEAK_SECRETS === "1") return;
  const problems = productionProblems(env);
  if (problems.length === 0) return;
  throw new Error(`Refusing to start: this install is served over https but its settings are not safe for that.\n - ${problems.join("\n - ")}\nFix .env (generate secrets with: openssl rand -base64 48) and start again.`);
}
