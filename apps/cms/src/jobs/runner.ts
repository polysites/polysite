import type { Payload } from "payload";

// Runs due background jobs (today: scheduled publish and unpublish) every 30 seconds, from inside the server.
// Payload's own scheduler only starts when an admin page is rendered, so after a restart nothing would run until someone
// opened the admin, and a page scheduled for 9:00 would wait. This timer has no such dependency. Jobs are locked while
// they run, so it is harmless alongside the notifications plugin's own schedule.
export function startJobRunner(payload: Payload, everyMs = 30_000) {
  const g = globalThis as { __polysiteJobs?: NodeJS.Timeout };
  if (g.__polysiteJobs) clearInterval(g.__polysiteJobs);
  const run = () => payload.jobs.run({ limit: 20 }).catch((err) => payload.logger.error({ err, msg: "Background job run failed" }));
  g.__polysiteJobs = setInterval(run, everyMs).unref();
}
