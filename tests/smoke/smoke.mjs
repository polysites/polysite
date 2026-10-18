// End-to-end smoke test for a FRESH Polysite install with no themes and no plugins. It drives the real stack through
// Caddy the way a person would: first-run setup, sign in, make a page, look at the public site, submit a form, follow a
// redirect, and check the things that have broken before (see Known Issue #56 in docs/ARCHITECTURE.md).
//
//   BASE=http://127.0.0.1:8080 node tests/smoke/smoke.mjs
//
// The stack is started by tests/smoke/run.sh (and by the "smoke" job in CI). Requests go to BASE with a Host header, as
// Caddy routes by hostname. Uses only Node's standard library.
import http from "node:http";

const BASE = new URL(process.env.BASE ?? "http://127.0.0.1:8080");
const SITE_HOST = process.env.SITE_HOST ?? "localhost:8080";
const CMS_HOST = process.env.CMS_HOST ?? "admin.localhost:8080";
const EMAIL = "smoke-admin@example.test";
const PASSWORD = "Smoke-Test-Password-4821";

function request(host, method, path, { body, token, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: BASE.hostname,
        port: BASE.port,
        method,
        path,
        headers: {
          Host: host,
          Accept: "text/html,application/json",
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
            /* an HTML page */
          }
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      },
    );
    req.setTimeout(60_000, () => req.destroy(new Error(`timeout: ${method} ${host}${path}`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const cms = (method, path, opts) => request(CMS_HOST, method, path, opts);
const site = (method, path, opts) => request(SITE_HOST, method, path, opts);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}
function expect(cond, message) {
  if (!cond) throw new Error(message);
}

async function waitForAdmin() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await cms("GET", "/admin/login");
      if (res.status === 200 || res.status === 307) return;
    } catch {
      /* not up yet */
    }
    await sleep(4000);
  }
  throw new Error("the admin never came up");
}

console.log(`Smoke test against ${BASE.origin} (site ${SITE_HOST}, admin ${CMS_HOST})`);
await waitForAdmin();

let token = "";
let session = ""; // the browser session cookie, for the admin's own pages
let pageId;

await step("a fresh install asks for first-run setup", async () => {
  const res = await cms("GET", "/admin");
  expect(res.status === 307 || res.status === 200, `GET /admin gave ${res.status}`);
  const setup = await cms("GET", "/admin/create-first-user");
  expect(setup.status === 200 && /Welcome to Polysite/.test(setup.text), "the setup page isn't shown");
});

await step("the health endpoint answers, and says nothing more than it should", async () => {
  const res = await cms("GET", "/api/health");
  expect(res.status === 200 && res.json?.status === "ok", `GET /api/health gave ${res.status}`);
  expect(Object.keys(res.json).sort().join() === "status,version", "the health response should carry only status and version");
});

await step("setup rejects a blank form with field errors, not a crash", async () => {
  const res = await cms("POST", "/api/setup", { body: {} });
  expect(res.status === 422, `expected 422, got ${res.status}`);
});

await step("setup creates the administrator and the first site", async () => {
  const res = await cms("POST", "/api/setup", {
    body: { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD, siteName: "Smoke Site", domain: "localhost", theme: "default", createHomePage: true },
  });
  expect(res.status === 200 && res.json?.ok, `setup gave ${res.status}: ${res.text.slice(0, 200)}`);
  const again = await cms("POST", "/api/setup", {
    body: { email: "other@example.test", password: PASSWORD, confirmPassword: PASSWORD, siteName: "Other", domain: "other.test", theme: "default", createHomePage: false },
  });
  expect(again.status >= 400, "setup must refuse to run a second time");
});

await step("the administrator can sign in", async () => {
  const res = await cms("POST", "/api/users/login", { body: { email: EMAIL, password: PASSWORD } });
  expect(res.status === 200 && res.json?.token, `login gave ${res.status}`);
  token = res.json.token;
  session = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
  expect(session.includes("payload-token"), "no session cookie was set");
});

await step("the public home page renders with the site's own name and no invented navigation", async () => {
  const res = await site("GET", "/");
  expect(res.status === 200, `GET / gave ${res.status}`);
  expect(/<title>Home \| Smoke Site<\/title>/.test(res.text), "the tab title doesn't use the site's name");
  expect(/Welcome to Smoke Site/.test(res.text), "the starter home page content is missing");
  expect(!/Donate/.test(res.text), "a new site shows a Donate button");
  for (const invented of ["/leader", "/take-action", "Become a member"]) expect(!res.text.includes(invented), `invented link ${invented} is shown`);
});

await step("a missing page is a branded 404, not the framework's", async () => {
  const res = await site("GET", "/definitely-not-here");
  expect(res.status === 404, `expected 404, got ${res.status}`);
  expect(/We can.t find that page/.test(res.text) || /We can&#39;t find that page/.test(res.text), "the Polysite 404 page isn't shown");
  expect(!/<title>[^<]*Nuxt/.test(res.text), "the tab title mentions Nuxt");
});

await step("without plugins there is no news section or feed", async () => {
  expect((await site("GET", "/news")).status === 404, "/news should be 404");
  expect((await site("GET", "/feed.xml")).status === 404, "/feed.xml should be 404");
});

await step("a blank required field is a 400 with a message, not a 500", async () => {
  const res = await cms("POST", "/api/pages", { token, body: { title: "No slug", site: 1, _status: "draft" } });
  expect(res.status === 400, `expected 400, got ${res.status}`);
  const redirect = await cms("POST", "/api/redirects", { token, body: { site: 1, redirectType: "external", toUrl: "https://example.test", statusCode: "301" } });
  expect(redirect.status === 400, `expected 400 for a redirect without a from-path, got ${redirect.status}`);
});

await step("an editor can publish a page and it appears on the site and in the sitemap", async () => {
  const res = await cms("POST", "/api/pages", {
    token,
    body: { title: "About", slug: "about", site: 1, _status: "published", content: [{ blockType: "hero", heading: "About this smoke site", subheading: "Hello" }] },
  });
  expect(res.status === 201, `creating the page gave ${res.status}: ${res.text.slice(0, 200)}`);
  pageId = res.json.doc.id;
  const page = await site("GET", "/about");
  expect(page.status === 200 && /About this smoke site/.test(page.text), "the new page isn't served");
  const sitemap = await site("GET", "/sitemap.xml");
  expect(sitemap.status === 200 && /\/about</.test(sitemap.text), "the new page isn't in the sitemap");
});

await step("a draft saved over a live page stays private until it is published, and unpublishing takes it down", async () => {
  const live = async () => (await cms("GET", `/api/pages?where[slug][equals]=about&where[site][equals]=1&depth=0`)).json?.docs?.[0] ?? null;
  const draft = await cms("PATCH", `/api/pages/${pageId}?draft=true`, { token, body: { title: "About (draft edit)", _status: "draft" } });
  expect(draft.status === 200, `saving the draft gave ${draft.status}: ${draft.text.slice(0, 160)}`);
  expect((await live())?.title === "About", "a draft changed what visitors can read");
  const publish = await cms("PATCH", `/api/pages/${pageId}`, { token, body: { title: "About (draft edit)", _status: "published" } });
  expect(publish.status === 200, `publishing gave ${publish.status}`);
  expect((await live())?.title === "About (draft edit)", "publishing didn't make the change public");
  const versions = await cms("GET", `/api/pages/versions?where[parent][equals]=${pageId}&limit=20`, { token });
  expect((versions.json?.docs ?? []).length >= 3, `expected the saves in the version history, got ${versions.json?.docs?.length}`);
  const down = await cms("PATCH", `/api/pages/${pageId}`, { token, body: { _status: "draft" } });
  expect(down.status === 200 && (await live()) === null, "unpublishing didn't take the page down");
  const up = await cms("PATCH", `/api/pages/${pageId}`, { token, body: { _status: "published" } });
  expect(up.status === 200 && (await live())?.title === "About (draft edit)", "publishing again didn't bring it back");
});

await step("a redirect to that page works", async () => {
  const res = await cms("POST", "/api/redirects", {
    token,
    body: { site: 1, fromPath: "old-about", redirectType: "internal", toTarget: { relationTo: "pages", value: pageId }, statusCode: "301", enabled: true },
  });
  expect(res.status === 201, `creating the redirect gave ${res.status}: ${res.text.slice(0, 200)}`);
  const hop = await site("GET", "/old-about");
  expect(hop.status === 301 && hop.headers.location === "/about", `expected 301 to /about, got ${hop.status} ${hop.headers.location}`);
});

await step("a visitor can submit a form and it is stored", async () => {
  const form = await cms("POST", "/api/forms", {
    token,
    body: {
      title: "Contact",
      site: 1,
      fields: [{ blockType: "email", name: "email", label: "Email", required: true }],
      submitButtonLabel: "Send",
      confirmationType: "message",
      confirmationMessage: { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "Thanks", version: 1 }], version: 1 }], direction: "ltr", format: "", indent: 0, version: 1 } },
    },
  });
  expect(form.status === 201, `creating the form gave ${form.status}: ${form.text.slice(0, 200)}`);
  const id = form.json.doc.id;
  const def = await site("GET", `/api/form-intake/${id}`);
  expect(def.status === 200 && def.json?.token, `the public form definition gave ${def.status}`);
  const tooFast = await site("POST", `/api/form-intake/${id}`, { body: { data: { email: "v@example.test" }, token: def.json.token } });
  expect(tooFast.status === 429, `a submission straight after load should be rate-limited, got ${tooFast.status}`);
  // The token has to age a few seconds before a person could plausibly have filled the form in.
  const fresh = await site("GET", `/api/form-intake/${id}`);
  await sleep(6000);
  const sent = await site("POST", `/api/form-intake/${id}`, { body: { data: { email: "visitor@example.test" }, token: fresh.json.token, consent: true } });
  expect(sent.status === 200 && sent.json?.ok, `the submission gave ${sent.status}: ${sent.text.slice(0, 200)}`);
  const stored = await cms("GET", "/api/form-submissions?depth=0", { token });
  expect(stored.status === 200 && stored.json?.totalDocs === 1, `expected 1 stored submission, got ${stored.json?.totalDocs}`);
});

await step("a petition stores one signature per person and shows a public count", async () => {
  const confirmation = { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "Thanks", version: 1 }], version: 1 }], direction: "ltr", format: "", indent: 0, version: 1 } };
  const form = await cms("POST", "/api/forms", {
    token,
    body: {
      title: "Petition",
      site: 1,
      fields: [{ blockType: "text", name: "name", label: "Name" }, { blockType: "email", name: "email", label: "Email", required: true }],
      submitButtonLabel: "Sign",
      confirmationType: "message",
      confirmationMessage: confirmation,
      petition: { dedupe: "email", showCount: true, countOffset: 100, goal: 500 },
    },
  });
  expect(form.status === 201, `creating the petition gave ${form.status}: ${form.text.slice(0, 200)}`);
  const id = form.json.doc.id;
  const def = await site("GET", `/api/form-intake/${id}`);
  expect(def.json?.signatures?.goal === 500, `the form definition should offer the count with its goal, got ${JSON.stringify(def.json?.signatures)}`);

  const token1 = (await site("GET", `/api/form-intake/${id}`)).json.token;
  const token2 = (await site("GET", `/api/form-intake/${id}`)).json.token;
  const token3 = (await site("GET", `/api/form-intake/${id}`)).json.token;
  const token4 = (await site("GET", `/api/form-intake/${id}`)).json.token;
  await sleep(2500);
  const sign = (email, t) => site("POST", `/api/form-intake/${id}`, { body: { data: { name: "A Signer", email }, token: t, consent: true } });

  const first = await sign("Pat.Lee@Example.test", token1);
  expect(first.status === 200 && first.json?.ok, `the first signature gave ${first.status}: ${first.text.slice(0, 200)}`);
  const again = await sign("  pat.lee@EXAMPLE.test ", token2);
  expect(again.status === 200 && again.json?.ok, `a repeat signature should look like a success, got ${again.status}: ${again.text.slice(0, 200)}`);
  // The same new person twice at the same instant: the unique index lets only one through, and neither gets an error.
  const [raceA, raceB] = await Promise.all([sign("rush@example.test", token3), sign("RUSH@example.test", token4)]);
  expect(raceA.status === 200 && raceB.status === 200, `a double submit gave ${raceA.status} and ${raceB.status}`);

  const stored = await cms("GET", `/api/form-submissions?depth=0&where[form][equals]=${id}`, { token });
  expect(stored.json?.totalDocs === 2, `expected 2 stored signatures (pat, rush), got ${stored.json?.totalDocs}`);
  const count = await site("GET", `/api/form-intake/${id}/count`);
  expect(count.status === 200 && count.json?.count === 102 && count.json?.goal === 500, `expected a count of 102 with goal 500, got ${count.status} ${count.text.slice(0, 120)}`);
  expect(/max-age=10/.test(count.headers["cache-control"] ?? ""), `the count should be publicly cacheable for 10 seconds, got "${count.headers["cache-control"]}"`);
});

await step("the admin screens load", async () => {
  for (const path of ["/admin", "/admin/collections/pages", "/admin/collections/sites/1", "/admin/collections/roles", "/admin/collections/forms", "/admin/collections/media", "/admin/collections/redirects"]) {
    const res = await cms("GET", path, { headers: { Cookie: session } });
    expect(res.status === 200, `${path} gave ${res.status}`);
    expect(!/Welcome to Polysite|<title>Login/.test(res.text), `${path} sent the signed-in user to the login or setup page`);
    expect(!/Something went wrong|Application error/.test(res.text), `${path} shows an error`);
  }
});

await step("roles and sites don't mention modules from plugins that aren't installed", async () => {
  const roles = await cms("GET", "/api/roles?depth=0&limit=10", { token });
  const modules = new Set(roles.json.docs.flatMap((r) => r.modules ?? []));
  expect(!modules.has("posts"), "a role has the posts module without the posts plugin");
});

if (failures.length) {
  console.log(`\n${failures.length} step(s) failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nAll smoke steps passed.");
