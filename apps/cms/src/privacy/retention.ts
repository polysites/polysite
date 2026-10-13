import type { Payload } from "payload";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a submission received at `from` should be deleted, or undefined to keep it. */
export function computeExpiry(from: Date, retentionDays: number | null | undefined): string | undefined {
  if (!retentionDays || retentionDays < 1 || !Number.isFinite(retentionDays)) return undefined;
  return new Date(from.getTime() + Math.floor(retentionDays) * DAY_MS).toISOString();
}

/** Deletes every submission whose retention period has ended. Returns how many. */
export async function purgeExpired(payload: Payload, now = new Date()): Promise<number> {
  const result = await payload.delete({
    collection: "form-submissions",
    where: { expiresAt: { less_than: now.toISOString() } },
    overrideAccess: true,
  });
  return result.docs.length;
}

/**
 * Runs the purge shortly after boot and every few hours after. In-process, which
 * suits a single-server install; a second server would simply run it too, and
 * deleting twice is harmless.
 */
export function startRetentionPurge(payload: Payload, everyMs = 6 * 60 * 60 * 1000, firstAfterMs = 2 * 60 * 1000) {
  const g = globalThis as { __polysiteRetention?: { timer: NodeJS.Timeout; first: NodeJS.Timeout } };
  if (g.__polysiteRetention) {
    clearInterval(g.__polysiteRetention.timer);
    clearTimeout(g.__polysiteRetention.first);
  }
  const run = () =>
    purgeExpired(payload)
      .then((n) => {
        if (n > 0) payload.logger.info(`Retention: deleted ${n} expired form submission(s)`);
      })
      .catch((err) => payload.logger.error({ err, msg: "Retention purge failed" }));
  g.__polysiteRetention = { timer: setInterval(run, everyMs).unref(), first: setTimeout(run, firstAfterMs).unref() };
}
