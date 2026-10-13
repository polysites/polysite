// After restoring a backup, run this to delete again anyone who asked to be erased
// since that backup was taken. A restore brings back every submission that was in
// the backup, including the ones deleted afterwards on request, so without this a
// restore would quietly undo erasures.
//
// It reads the fingerprints kept on completed erasure requests (never the email
// addresses), compares them with every email-like value in every submission, and
// deletes the matches.
//
// Run in the CMS container: npx payload run scripts/reapplyErasures.ts
import { getPayload } from "payload";

import config from "../src/payload.config";
import { subjectHash } from "../src/privacy/subject";

async function main() {
  const payload = await getPayload({ config });
  const secret = process.env.PAYLOAD_SECRET || "";

  const erased = new Set<string>();
  for (let page = 1; ; page++) {
    const res = await payload.find({
      collection: "privacy-requests",
      where: { and: [{ status: { equals: "completed" } }, { subjectHash: { exists: true } }, { type: { in: ["erasure", "withdraw-consent"] } }] },
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
    });
    for (const r of res.docs) if (r.subjectHash) erased.add(r.subjectHash);
    if (!res.hasNextPage) break;
  }
  console.log(`${erased.size} erasure fingerprint(s) on record`);

  // Collect first, delete after: deleting while paging would shift the pages.
  const doomed: (number | string)[] = [];
  for (let page = 1; ; page++) {
    const res = await payload.find({ collection: "form-submissions", limit: 200, page, depth: 0, overrideAccess: true });
    for (const s of res.docs) {
      const values = (s.submissionData ?? []).map((row) => row.value).filter((v): v is string => typeof v === "string" && v.includes("@"));
      if (values.some((v) => erased.has(subjectHash(secret, v)))) doomed.push(s.id);
    }
    if (!res.hasNextPage) break;
  }
  for (const id of doomed) await payload.delete({ collection: "form-submissions", id, overrideAccess: true });
  console.log(`Deleted ${doomed.length} submission(s) belonging to people who had asked to be erased`);
}

// Top-level await: `payload run` exits as soon as this module's import() resolves,
// so a fire-and-forget call would never get to run (see seedDevData.ts).
try {
  await main();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
