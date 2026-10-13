import { timingSafeEqual } from "node:crypto";
import { createLocalReq, type Payload } from "payload";

import { OPEN_SETUP_MESSAGE, openSetupRefused } from "./policy";
import type { SetupValue } from "./validate";

/** An expected failure with a status the endpoint can return and a message safe to show. */
export class SetupError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// One process, one VM: a flag is enough to stop two submissions racing past the
// "no users yet" check at the same moment.
let inProgress = false;

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the install is still empty, i.e. the setup page may be used. */
export async function needsSetup(payload: Payload): Promise<boolean> {
  const { totalDocs } = await payload.count({ collection: "users", overrideAccess: true });
  return totalDocs === 0;
}

/**
 * Creates the first Super Admin, the first site and (optionally) its home page,
 * all in one transaction so a failure leaves nothing half-made. Refuses once any
 * user exists, so it can never be used to add accounts to a running install.
 */
export async function runSetup(payload: Payload, value: SetupValue): Promise<{ siteId: number | string }> {
  if (openSetupRefused()) throw new SetupError(OPEN_SETUP_MESSAGE, 403);
  const requiredToken = process.env.POLYSITE_SETUP_TOKEN;
  if (requiredToken && !tokenMatches(value.setupToken, requiredToken)) {
    throw new SetupError("The setup token is missing or wrong.", 403);
  }
  if (inProgress) throw new SetupError("Setup is already running. Wait a moment and reload.", 409);

  inProgress = true;
  try {
    if (!(await needsSetup(payload))) throw new SetupError("Polysite is already set up. Sign in instead.", 409);

    const roles = await payload.find({
      collection: "roles",
      where: { name: { equals: "Super Admin" } },
      limit: 1,
      overrideAccess: true,
    });
    const superAdminRole = roles.docs[0];
    if (!superAdminRole) {
      throw new SetupError("The default roles haven't been created yet. Restart the CMS and try again.", 500);
    }

    // `polysiteSetup` tells the Users guard (collections/Users.ts) that this
    // create is the sanctioned first-run one, not a direct first-register call.
    const req = await createLocalReq({ context: { polysiteSetup: true } }, payload);
    const transactionID = await payload.db.beginTransaction();
    if (transactionID) req.transactionID = transactionID;

    try {
      const user = await payload.create({
        collection: "users",
        data: { email: value.email, password: value.password, isSuperAdmin: true, role: superAdminRole.id },
        overrideAccess: true,
        req,
      });

      const site = await payload.create({
        collection: "sites",
        // `theme` is a union of whatever themes this install has, so the generated
        // type differs per install; validateSetup already checked the value.
        data: { name: value.siteName, domain: value.domain, theme: value.theme, showDonateButton: false } as never,
        overrideAccess: true,
        user,
        req,
      });

      if (value.createHomePage) {
        await payload.create({
          collection: "pages",
          data: {
            title: "Home",
            slug: "/",
            site: site.id,
            _status: "published",
            content: [
              {
                blockType: "hero",
                heading: `Welcome to ${value.siteName}`,
                subheading: "This site is up and running. Sign in to the admin to edit this page.",
              },
            ],
          },
          overrideAccess: true,
          user,
          req,
        });
      }

      if (transactionID) await payload.db.commitTransaction(transactionID);
      return { siteId: site.id };
    } catch (err) {
      if (transactionID) await payload.db.rollbackTransaction(transactionID);
      throw err;
    }
  } finally {
    inProgress = false;
  }
}
