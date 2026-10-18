// Load test for the public form intake (the petition path). It measures how many signatures a second one CMS container accepts, how long
// they take, and whether every accepted signature was really stored. Run by tests/load/run.sh against a fresh stack whose CMS and database
// have fixed CPU and memory limits; the numbers mean nothing against a dev server.
//
//   CMS=http://cms:3001 SITE_HOST=localhost node tests/load/intake-load.mjs
//
// It talks to the CMS directly, not through Caddy: Caddy replaces X-Forwarded-For with the real client address, so every request from one
// load generator would share one address and hit the per-address limit (8 a minute), which is a protection, not what is measured here.
// Standard library only.
import http from "node:http";

const CMS = new URL(process.env.CMS ?? "http://cms:3001");
const SITE_HOST = process.env.SITE_HOST ?? "localhost";
const STAGE_SECONDS = Number(process.env.STAGE_SECONDS ?? 15);
const LEVELS = (process.env.LEVELS ?? "10,25,50,100").split(",").map(Number);
const EMAIL = "load-admin@example.test";
const PASSWORD = "Load-Test-Password-4821";
const agent = new http.Agent({ keepAlive: true, maxSockets: 400 });

function request(method, path, { body, token, host = SITE_HOST, headers = {} } = {}) {
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const started = process.hrtime.bigint();
    const req = http.request(
      {
        agent,
        hostname: CMS.hostname,
        port: CMS.port,
        method,
        path,
        headers: {
          Host: host,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `JWT ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            /* not JSON */
          }
          resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - started) / 1e6, text, json });
        });
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error("timeout")));
    req.on("error", (err) => resolve({ status: 0, ms: Number(process.hrtime.bigint() - started) / 1e6, text: String(err), json: undefined }));
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

/** Runs `fn(i)` from `concurrency` workers for `seconds`, and summarises the answers. */
async function stage(name, concurrency, seconds, fn) {
  const latencies = [];
  const statuses = new Map();
  let i = 0;
  const end = Date.now() + seconds * 1000;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (Date.now() < end) {
        const res = await fn(i++);
        latencies.push(res.ms);
        statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      }
    }),
  );
  const elapsed = (Date.now() - t0) / 1000;
  latencies.sort((a, b) => a - b);
  const total = latencies.length;
  const ok = statuses.get(200) ?? 0;
  const row = {
    stage: name,
    concurrency,
    requests: total,
    perSecond: Math.round((total / elapsed) * 10) / 10,
    okPerSecond: Math.round((ok / elapsed) * 10) / 10,
    p50ms: Math.round(pct(latencies, 50)),
    p95ms: Math.round(pct(latencies, 95)),
    p99ms: Math.round(pct(latencies, 99)),
    statuses: Object.fromEntries([...statuses].sort()),
  };
  console.log(JSON.stringify(row));
  return { row, ok };
}

// --- set up a fresh install and a petition form ---------------------------------------------------------------------------------------
const setup = await request("POST", "/api/setup", {
  host: "admin.localhost",
  body: { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD, siteName: "Load Site", domain: SITE_HOST, theme: "default", createHomePage: true },
});
if (setup.status !== 200) throw new Error(`setup gave ${setup.status}: ${setup.text.slice(0, 200)}`);
const login = await request("POST", "/api/users/login", { host: "admin.localhost", body: { email: EMAIL, password: PASSWORD } });
const token = login.json?.token;
if (!token) throw new Error(`login gave ${login.status}`);

const confirmation = { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "Thanks", version: 1 }], version: 1 }], direction: "ltr", format: "", indent: 0, version: 1 } };
const created = await request("POST", "/api/forms", {
  host: "admin.localhost",
  token,
  body: {
    title: "Load petition",
    site: 1,
    fields: [{ blockType: "text", name: "name", label: "Name" }, { blockType: "email", name: "email", label: "Email", required: true }],
    submitButtonLabel: "Sign",
    confirmationType: "message",
    confirmationMessage: confirmation,
    petition: { dedupe: "email", showCount: true, goal: 100000 },
  },
});
if (created.status !== 201) throw new Error(`creating the form gave ${created.status}: ${created.text.slice(0, 200)}`);
const formId = created.json.doc.id;

// The signed token is not single-use and is valid for hours, so one is enough for a load test (a real browser fetches its own).
const def = await request("GET", `/api/form-intake/${formId}`);
const signedToken = def.json?.token;
if (!signedToken) throw new Error(`the form definition gave ${def.status}`);
await sleep(2500);

const ip = (n) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
const sign = (email, n) =>
  request("POST", `/api/form-intake/${formId}`, {
    headers: { "X-Forwarded-For": ip(n) },
    body: { token: signedToken, consent: true, data: { name: "Load Tester", email } },
  });

console.log(JSON.stringify({ note: "limits and setup done", formId, stageSeconds: STAGE_SECONDS, levels: LEVELS }));

// --- 1. new signatures, rising concurrency ---------------------------------------------------------------------------------------------
let expectedStored = 0;
let serial = 0;
const rows = [];
for (const c of LEVELS) {
  const { row, ok } = await stage(`new signatures x${c}`, c, STAGE_SECONDS, () => {
    const n = serial++;
    return sign(`signer.${n}@load.example.test`, n);
  });
  expectedStored += ok;
  rows.push(row);
}

// --- 2. repeat signatures (the de-duplication path): same addresses again -----------------------------------------------------------------
const repeat = await stage("repeat signatures x50", 50, STAGE_SECONDS, (i) => sign(`signer.${i % 500}@load.example.test`, 1_000_000 + i));
rows.push(repeat.row);

// --- 3. the public count, read by many visitors -------------------------------------------------------------------------------------------
const count = await stage("public count x100", 100, 10, (i) => request("GET", `/api/form-intake/${formId}/count`, { headers: { "X-Forwarded-For": ip(2_000_000 + (i % 100_000)) } }));
rows.push(count.row);

// --- 4. page loads: the form definition, as every visitor's browser fetches it -----------------------------------------------------------------
const defs = await stage("form definition x50", 50, 10, (i) => request("GET", `/api/form-intake/${formId}`, { headers: { "X-Forwarded-For": ip(3_000_000 + (i % 100_000)) } }));
rows.push(defs.row);

// --- accuracy: every accepted new signature is stored once, and nothing else is ------------------------------------------------------------
const stored = await request("GET", `/api/form-submissions?depth=0&limit=0&where[form][equals]=${formId}`, { host: "admin.localhost", token });
const storedCount = stored.json?.totalDocs;
const finalCount = await request("GET", `/api/form-intake/${formId}/count`);
console.log(JSON.stringify({ accepted_new_signatures: expectedStored, stored_in_database: storedCount, public_count_after_cache: finalCount.json?.count, match: storedCount === expectedStored }));
console.log(JSON.stringify({ summary: rows.map((r) => ({ stage: r.stage, perSecond: r.perSecond, okPerSecond: r.okPerSecond, p50ms: r.p50ms, p95ms: r.p95ms, p99ms: r.p99ms, statuses: r.statuses })) }));
agent.destroy();
process.exit(storedCount === expectedStored ? 0 : 1);
