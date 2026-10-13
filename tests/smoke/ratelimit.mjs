// Load check for the public site's per-address request cap (docs/guide/security.md). Run against a stack through Caddy:
//
//   BASE=http://127.0.0.1:8080 SITE_HOST=localhost:8080 node tests/smoke/ratelimit.mjs
//
// tests/smoke/run.sh runs it after the smoke test. It sends page requests from this one address and checks that
//   1. the old library default (150 requests per 5 minutes) is gone: the first 200 requests are all answered;
//   2. the cap still triggers: a 429 arrives with a Retry-After header and a plain page, no later than request
//      EXPECT_LIMIT (default 600) plus the few requests the stack had already counted from this address;
//   3. files the build serves (/_nuxt/...) are still answered while the address is over the cap.
// EXPECT_LIMIT must match POLYSITE_WEB_RATE_LIMIT on the stack. Standard library only.
import http from "node:http";

const BASE = new URL(process.env.BASE ?? "http://127.0.0.1:8080");
const HOST = process.env.SITE_HOST ?? "localhost:8080";
const LIMIT = Number(process.env.EXPECT_LIMIT ?? 600);
const agent = new http.Agent({ keepAlive: true, maxSockets: 10 });

const get = (path) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: BASE.hostname, port: BASE.port, path, agent, headers: { Host: HOST, Accept: "text/html" } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout: ${path}`)));
    req.on("error", reject);
    req.end();
  });

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

// Page requests, ten at a time. The window is 60 seconds by default; if it rolls over mid-run the counter restarts, so allow two caps' worth.
let sent = 0;
let firstLimited = null;
const early = [];
const worker = async () => {
  while (firstLimited === null && sent < LIMIT * 2 + 100) {
    const n = ++sent;
    const res = await get("/about");
    if (res.status === 429) {
      if (firstLimited === null) firstLimited = { n, res };
    } else if (n <= 200) {
      early.push(res.status);
    }
  }
};
await Promise.all(Array.from({ length: 10 }, worker));

if (firstLimited === null) fail(`no 429 after ${sent} page requests; the cap is not enforced (expected about ${LIMIT})`);
if (LIMIT > 200 && firstLimited.n <= 200) fail(`limited already at request ${firstLimited.n}: the old 150 per 5 minutes behaviour is back`);
if (firstLimited.n > LIMIT + 20) fail(`first 429 at request ${firstLimited.n}, expected near ${LIMIT}`);
const { res } = firstLimited;
if (!/^\d+$/.test(String(res.headers["retry-after"] ?? ""))) fail(`429 without a numeric Retry-After (got ${res.headers["retry-after"]})`);
if (!res.text.includes("Too many requests") || /<script/i.test(res.text)) fail("the 429 body is not the plain page");
console.log(`ok: ${firstLimited.n - 1} page requests answered, then 429 with Retry-After ${res.headers["retry-after"]}s`);

// While over the cap, files the build serves are still answered (they are not counted).
const asset = await get("/_nuxt/does-not-exist.js");
if (asset.status === 429) fail("a /_nuxt file was limited");
console.log(`ok: /_nuxt files are not counted (${asset.status})`);
agent.destroy();
