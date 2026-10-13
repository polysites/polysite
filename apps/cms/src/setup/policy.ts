// Whether the first-account setup is refused because the install is on a public address (https) and nothing guards it.
// Without a token, whoever reached /api/setup (or Payload's own first-register) first would become Super Admin of a server
// that is already on the internet. POLYSITE_ALLOW_OPEN_SETUP=1 lifts this for a throwaway or staging install.
export function openSetupRefused(env: Record<string, string | undefined> = process.env): boolean {
  if (env.POLYSITE_SETUP_TOKEN) return false;
  if (env.POLYSITE_ALLOW_OPEN_SETUP === "1") return false;
  return (env.CMS_SCHEME ?? "").toLowerCase() === "https";
}

export const OPEN_SETUP_MESSAGE =
  "This server is on https, so the first account needs a setup token. Set POLYSITE_SETUP_TOKEN in .env, restart the CMS, and enter it on the setup page.";
