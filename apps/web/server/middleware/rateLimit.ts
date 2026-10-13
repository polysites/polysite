// The public site's per-address request cap. Settings and the reasoning: server/utils/webRateLimit.ts and docs/guide/security.md.
import { clientAddress, createLimiter, isExempt, limitedPage, readConfig } from "../utils/webRateLimit";

const limiter = createLimiter();
// Read once per process: the environment does not change while the server runs.
const config = readConfig();

export default defineEventHandler((event) => {
  if (config.off) return;
  const pathname = (event.path || "/").split("?")[0];
  if (isExempt(pathname)) return;
  const address = clientAddress((name) => getRequestHeader(event, name), event.node.req.socket?.remoteAddress, config);
  if (!address) return; // not a visitor request (the stack calling itself)
  const verdict = limiter.hit(address, config);
  if (verdict.allowed) return;
  setResponseStatus(event, 429, "Too Many Requests");
  setResponseHeader(event, "Retry-After", verdict.retryAfter);
  setResponseHeader(event, "Cache-Control", "no-store");
  const wantsHtml = (getRequestHeader(event, "accept") ?? "").includes("text/html");
  setResponseHeader(event, "Content-Type", wantsHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
  return wantsHtml ? limitedPage(verdict.retryAfter) : `Too many requests. Try again in ${verdict.retryAfter} seconds.\n`;
});
