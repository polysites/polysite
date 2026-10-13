// Local development only: runs every installed plugin's demo-content seed (see devPlugins.ts) against the dev
// site (voidslate.localhost) of a database that already has its sites. Safe to run twice.
// Run inside the CMS container: npx payload run scripts/seedDevPlugins.ts
import { getPayload } from "payload";

import config from "../src/payload.config";
import { seedPluginDevData } from "./devPlugins";

{
  const payload = await getPayload({ config });
  const sites = await payload.find({ collection: "sites", where: { domain: { equals: "voidslate.localhost" } }, limit: 1, depth: 0, overrideAccess: true });
  const site = sites.docs[0];
  if (!site) console.log("No voidslate.localhost site here; nothing to do.");
  else await seedPluginDevData(payload, site);
  process.exit(0);
}
