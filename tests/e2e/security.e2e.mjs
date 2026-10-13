// End-to-end check of the access rules found in the security review (docs/guide/security.md and Known Issue 67 in docs/ARCHITECTURE.md) against a RUNNING stack:
// one site's people cannot reach another site's unpublished pages, the URL index does not publish drafts, a role without
// the right permission cannot read page versions, and the lockout cannot be undone by any signed-in user. Creates its own
// roles, users and a second site, and removes them.
//
//   BASE=http://cms:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... SITE_ID=1 node tests/e2e/security.e2e.mjs
const BASE = process.env.BASE;
const SITE_ID = Number(process.env.SITE_ID ?? 1);
const results = [];
const ok = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : " " + extra}`);
};

async function api(method, path, { token, body } = {}) {
  // A refused oversized upload closes its connection; the next request on it can be reset, so one retry is allowed.
  const send = () =>
    fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `JWT ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const res = await send().catch(() => send());
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
const login = async (email, password) => (await api("POST", "/api/users/login", { body: { email, password } })).json?.token;

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
ok("admin signs in", Boolean(admin));

const stamp = Date.now();
const password = "Sec-E2e-Password-5530";
const created = { pages: [], users: [], roles: [], sites: [] };
try {
  const other = await api("POST", "/api/sites", { token: admin, body: { name: `Sec other ${stamp}`, domain: `sec-other-${stamp}.example.test` } });
  const otherSite = other.json?.doc?.id;
  created.sites.push(otherSite);
  ok("a second site exists", Boolean(otherSite), other.text.slice(0, 200));

  const allOps = { create: true, read: true, update: true, delete: true, publish: true, unpublish: true, cloneAcrossSites: true };
  const editorRole = (await api("POST", "/api/roles", { token: admin, body: { name: `Sec editor ${stamp}`, modules: ["pages", "media"], operations: allOps } })).json?.doc?.id;
  const mediaRole = (await api("POST", "/api/roles", { token: admin, body: { name: `Sec media only ${stamp}`, modules: ["media"], operations: { create: true, read: true } } })).json?.doc?.id;
  created.roles.push(editorRole, mediaRole);
  const mk = async (tag, role) => {
    const email = `sec-${tag}-${stamp}@example.test`;
    const made = await api("POST", "/api/users", { token: admin, body: { email, password, role, assignedSites: [{ site: SITE_ID }] } });
    created.users.push(made.json?.doc?.id);
    return { email, token: await login(email, password) };
  };
  const editor = await mk("editor", editorRole);
  const mediaOnly = await mk("media", mediaRole);
  ok("an editor and a media-only user can sign in", Boolean(editor.token && mediaOnly.token));

  // --- the session cookie
  const signIn = await fetch(BASE + "/api/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: editor.email, password }) });
  const cookie = signIn.headers.get("set-cookie") ?? "";
  ok("the session cookie is HttpOnly and SameSite", /HttpOnly/i.test(cookie) && /SameSite=(Lax|Strict)/i.test(cookie), cookie.replace(/payload-token=[^;]+/, "payload-token=..."));

  // --- another site's unpublished page cannot be copied (and so read) through the clone endpoint
  const secret = await api("POST", "/api/pages?draft=true", { token: admin, body: { title: `Sec secret draft ${stamp}`, slug: `sec-secret-${stamp}`, site: otherSite, content: [] } });
  const secretId = secret.json?.doc?.id;
  created.pages.push(secretId);
  const stolen = await api("POST", `/api/pages/${secretId}/clone`, { token: editor.token, body: { targetSiteId: SITE_ID } });
  ok("an editor cannot clone a page of a site they are not on", stolen.status === 404 || stolen.status === 403, `${stolen.status} ${stolen.text.slice(0, 160)}`);
  if (stolen.json?.doc?.id) created.pages.push(stolen.json.doc.id);

  // --- the URL index does not publish a draft's title or address
  const draft = await api("POST", "/api/pages?draft=true", { token: editor.token, body: { title: `Sec unannounced ${stamp}`, slug: `sec-unannounced-${stamp}`, site: SITE_ID, content: [] } });
  const draftId = draft.json?.doc?.id;
  created.pages.push(draftId);
  ok("an editor can save a draft", draft.status === 201, draft.text.slice(0, 160));
  const indexQuery = `/api/site-urls?where[path][equals]=sec-unannounced-${stamp}&depth=0`;
  const anonIndex = await api("GET", indexQuery);
  ok("a visitor cannot see a draft in the URL index", anonIndex.status === 200 && anonIndex.json?.totalDocs === 0, anonIndex.text.slice(0, 200));
  const editorIndex = await api("GET", indexQuery, { token: editor.token });
  ok("the editor still sees it", editorIndex.json?.totalDocs === 1, editorIndex.text.slice(0, 200));
  const rowId = (await api("GET", indexQuery, { token: admin })).json?.docs?.[0]?.id;
  const patch = await api("PATCH", `/api/site-urls/${rowId}`, { token: editor.token, body: { path: "tampered" } });
  const del = await api("DELETE", `/api/site-urls/${rowId}`, { token: editor.token });
  ok("an editor cannot change or delete URL index entries", patch.status === 403 && del.status === 403, `${patch.status} ${del.status}`);

  // --- version history follows the pages permission
  const noVersions = await api("GET", "/api/pages/versions?limit=1", { token: mediaOnly.token });
  const versions = await api("GET", "/api/pages/versions?limit=1", { token: editor.token });
  ok("a role without pages:read cannot read page versions", noVersions.status === 403, String(noVersions.status));
  ok("a role with pages:read can", versions.status === 200, String(versions.status));

  // --- lockout cannot be undone by another signed-in user
  const unlock = await api("POST", "/api/users/unlock", { token: editor.token, body: { email: mediaOnly.email } });
  ok("an editor cannot unlock another account", unlock.status === 403, `${unlock.status} ${unlock.text.slice(0, 120)}`);

  // --- editorial notes are not public
  const published = await api("POST", "/api/pages", { token: editor.token, body: { title: `Sec live ${stamp}`, slug: `sec-live-${stamp}`, site: SITE_ID, _status: "published", content: [] } });
  created.pages.push(published.json?.doc?.id);
  const anonPage = await api("GET", `/api/pages/${published.json?.doc?.id}?depth=0`);
  const keys = Object.keys(anonPage.json ?? {});
  ok("a visitor's copy of a page has no review fields", anonPage.status === 200 && !keys.includes("reviewState") && !keys.includes("reviewNote"), keys.join(","));

  // --- one upload cannot be arbitrarily large
  const big = new FormData();
  big.append("_payload", JSON.stringify({ alt: "big", site: SITE_ID }));
  big.append("file", new Blob([new Uint8Array(30 * 1024 * 1024)], { type: "text/plain" }), `big-${stamp}.txt`);
  const upload = await fetch(BASE + "/api/media", { method: "POST", headers: { Authorization: `JWT ${editor.token}` }, body: big }).catch((e) => ({ status: `error ${e.message}` }));
  ok("a 30 MB upload is refused", upload.status !== 201 && upload.status !== 200, String(upload.status));
} finally {
  for (const id of created.pages.filter(Boolean)) await api("DELETE", `/api/pages/${id}`, { token: admin });
  for (const id of created.users.filter(Boolean)) await api("DELETE", `/api/users/${id}`, { token: admin });
  for (const id of created.roles.filter(Boolean)) await api("DELETE", `/api/roles/${id}`, { token: admin });
  for (const id of created.sites.filter(Boolean)) await api("DELETE", `/api/sites/${id}`, { token: admin });
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} of ${results.length} security checks FAILED` : `All ${results.length} security checks passed.`);
process.exit(failed ? 1 : 0);
