// End-to-end check of the content workflow (drafts, publishing, version history, permissions, scheduling) against a RUNNING
// dev stack. Not part of CI: it needs the whole app up, a Super Admin login, and it creates and removes its own test data.
//
//   BASE=http://cms:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... SITE_ID=1 SITE_HOST=voidslate.localhost node tests/e2e/workflow.e2e.mjs
//
// Scheduled publishing is exercised separately (tests/e2e/schedule.e2e.ts, run inside the CMS container) because the admin
// queues it through a server function that has no REST address.
const BASE = process.env.BASE;
const SITE_ID = Number(process.env.SITE_ID ?? 1);
const SITE_HOST = process.env.SITE_HOST ?? "voidslate.localhost";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : " " + extra}`);
};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `JWT ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const login = async (email, password) => (await api("POST", "/api/users/login", { body: { email, password } })).json?.token;
const publicPage = async (slug) =>
  (await api("GET", `/api/pages?where[slug][equals]=${slug}&where[site.domain][equals]=${SITE_HOST}&depth=0`)).json?.docs?.[0] ?? null;

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
ok("admin signs in", Boolean(admin));

const stamp = Date.now();
const slug = `wf-test-${stamp}`;
let pageId;
let roleId;
let editorId;
try {
  // --- a role that can edit but not publish, and a person with it
  const role = await api("POST", "/api/roles", { token: admin, body: { name: `Editor without publish ${stamp}`, modules: ["pages", "posts"], operations: { create: true, read: true, update: true } } });
  roleId = role.json?.doc?.id;
  ok("a role without the publish permission can be made", role.status === 201, JSON.stringify(role.json)?.slice(0, 200));
  const editorEmail = `wf-editor-${stamp}@example.test`;
  const editorPassword = "Wf-Editor-Password-4417";
  const made = await api("POST", "/api/users", { token: admin, body: { email: editorEmail, password: editorPassword, role: roleId, assignedSites: [{ site: SITE_ID }] } });
  editorId = made.json?.doc?.id;
  ok("and a person with that role", made.status === 201, JSON.stringify(made.json)?.slice(0, 200));
  const editor = await login(editorEmail, editorPassword);
  ok("who can sign in", Boolean(editor));

  // --- a page that was never published is not public
  const created = await api("POST", "/api/pages?draft=true", { token: editor, body: { title: "Workflow test", slug, site: SITE_ID, content: [] } });
  pageId = created.json?.doc?.id;
  ok("an editor can save a new page as a draft", created.status === 201 && created.json?.doc?._status === "draft", JSON.stringify(created.json)?.slice(0, 200));
  ok("a draft is not public", (await publicPage(slug)) === null);

  // --- permission to publish
  const denied = await api("PATCH", `/api/pages/${pageId}`, { token: editor, body: { _status: "published" } });
  ok("an editor without the publish permission can't publish", denied.status === 403, `${denied.status} ${JSON.stringify(denied.json)?.slice(0, 160)}`);
  ok("and it stays hidden", (await publicPage(slug)) === null);

  const published = await api("PATCH", `/api/pages/${pageId}`, { token: admin, body: { _status: "published" } });
  ok("someone who can publish publishes it", published.status === 200 && published.json?.doc?._status === "published");
  const live = await publicPage(slug);
  ok("and visitors see it", live?.title === "Workflow test");

  // --- a draft over a live page leaves the live page alone
  const draftEdit = await api("PATCH", `/api/pages/${pageId}?draft=true`, { token: editor, body: { title: "Workflow test (edited)", _status: "draft" } });
  ok("an editor can save a draft over a live page", draftEdit.status === 200 && draftEdit.json?.doc?._status === "draft", JSON.stringify(draftEdit.json)?.slice(0, 200));
  ok("visitors still see the live version", (await publicPage(slug))?.title === "Workflow test");
  const seen = await api("GET", `/api/pages/${pageId}?draft=true`, { token: editor });
  ok("the editor sees their draft", seen.json?.title === "Workflow test (edited)");

  // --- review
  const submit = await api("PATCH", `/api/pages/${pageId}?draft=true`, { token: editor, body: { reviewState: "in-review", reviewNote: "Please check the wording", _status: "draft" } });
  ok("an editor can mark a draft ready for review", submit.status === 200 && submit.json?.doc?.reviewState === "in-review", JSON.stringify(submit.json)?.slice(0, 200));
  const sendBack = await api("PATCH", `/api/pages/${pageId}?draft=true`, { token: editor, body: { reviewState: "changes-requested", _status: "draft" } });
  const afterSendBack = await api("GET", `/api/pages/${pageId}?draft=true`, { token: admin });
  ok("but only a publisher can send it back", afterSendBack.json?.reviewState !== "changes-requested", `${sendBack.status} ${afterSendBack.json?.reviewState}`);
  const asked = await api("PATCH", `/api/pages/${pageId}?draft=true`, { token: admin, body: { reviewState: "changes-requested", reviewNote: "Shorter please", _status: "draft" } });
  ok("a publisher can ask for changes", asked.status === 200 && asked.json?.doc?.reviewState === "changes-requested", JSON.stringify(asked.json)?.slice(0, 200));
  const inReview = await api("GET", `/api/pages?draft=true&where[reviewState][equals]=changes-requested&where[id][equals]=${pageId}`, { token: admin });
  ok("the list can be filtered on review state", (inReview.json?.docs ?? []).length === 1);

  // --- the live page can't be changed or taken down without permission
  const sneaky = await api("PATCH", `/api/pages/${pageId}`, { token: editor, body: { title: "Sneaky edit" } });
  ok("an ordinary save of a live page needs the publish permission", sneaky.status === 403, `${sneaky.status}`);
  const unpublishDenied = await api("PATCH", `/api/pages/${pageId}`, { token: editor, body: { _status: "draft" } });
  ok("and so does taking it down", unpublishDenied.status === 403, `${unpublishDenied.status}`);
  ok("the live page is untouched by all of that", (await publicPage(slug))?.title === "Workflow test");

  // --- publish the draft changes
  const publishEdit = await api("PATCH", `/api/pages/${pageId}`, { token: admin, body: { title: "Workflow test (edited)", _status: "published" } });
  ok("publishing the draft changes", publishEdit.status === 200);
  ok("puts them live", (await publicPage(slug))?.title === "Workflow test (edited)");

  const afterPublish = await api("GET", `/api/pages/${pageId}?draft=true`, { token: admin });
  ok("publishing clears the review marker", afterPublish.json?.reviewState === "none" && !afterPublish.json?.reviewNote, JSON.stringify([afterPublish.json?.reviewState, afterPublish.json?.reviewNote]));

  // --- history and restore
  const versions = await api("GET", `/api/pages/versions?where[parent][equals]=${pageId}&sort=-createdAt&limit=20`, { token: admin });
  const titles = (versions.json?.docs ?? []).map((v) => `${v.version._status}:${v.version.title}`);
  ok("every save is in the version history", titles.length >= 4, titles.join(" | "));
  const oldest = (versions.json?.docs ?? []).find((v) => v.version.title === "Workflow test" && v.version._status === "published");
  const restored = oldest ? await api("POST", `/api/pages/versions/${oldest.id}`, { token: admin }) : { status: 0 };
  ok("an older version can be restored", restored.status === 200, `${restored.status} ${JSON.stringify(restored.json)?.slice(0, 160)}`);
  const afterRestore = await api("GET", `/api/pages/${pageId}?draft=true`, { token: admin });
  ok("and becomes the current version", afterRestore.json?.title === "Workflow test", afterRestore.json?.title);

  // --- taking it down
  const down = await api("PATCH", `/api/pages/${pageId}`, { token: admin, body: { _status: "draft" } });
  ok("a publisher can unpublish", down.status === 200);
  ok("and it is no longer public", (await publicPage(slug)) === null);

  // --- the address change keeps the old address working
  const slugB = `${slug}-renamed`;
  await api("PATCH", `/api/pages/${pageId}`, { token: admin, body: { _status: "published" } });
  await api("PATCH", `/api/pages/${pageId}?draft=true`, { token: admin, body: { slug: slugB, _status: "draft" } });
  const redirectsAfterDraft = await api("GET", `/api/redirects?where[fromPath][equals]=${slug}`, { token: admin });
  ok("a draft with a new address makes no redirect yet", (redirectsAfterDraft.json?.docs ?? []).length === 0);
  await api("PATCH", `/api/pages/${pageId}`, { token: admin, body: { slug: slugB, _status: "published" } });
  const redirectsAfterPublish = await api("GET", `/api/redirects?where[fromPath][equals]=${slug}`, { token: admin });
  ok("publishing the new address redirects the old live one", (redirectsAfterPublish.json?.docs ?? []).length === 1, JSON.stringify(redirectsAfterPublish.json?.docs?.length));
  const urlIndex = await api("GET", `/api/site-urls?where[path][equals]=${slugB}`, { token: admin });
  ok("the URL index follows the live address and status", urlIndex.json?.docs?.[0]?.status === "published", JSON.stringify(urlIndex.json?.docs?.[0]));

  // --- a copy is a draft
  const dup = await api("POST", `/api/pages?draft=true`, { token: admin, body: { title: "Copy", slug: `${slug}-copy`, site: SITE_ID, content: [] } });
  ok("a new page starts as a draft", dup.json?.doc?._status === "draft");
  if (dup.json?.doc?.id) await api("DELETE", `/api/pages/${dup.json.doc.id}`, { token: admin });
} finally {
  if (pageId) {
    const redirects = await api("GET", `/api/redirects?where[fromPath][like]=wf-test-${stamp}&limit=20`, { token: admin });
    for (const r of redirects.json?.docs ?? []) await api("DELETE", `/api/redirects/${r.id}`, { token: admin });
    await api("DELETE", `/api/pages/${pageId}`, { token: admin });
  }
  if (editorId) await api("DELETE", `/api/users/${editorId}`, { token: admin });
  if (roleId) await api("DELETE", `/api/roles/${roleId}`, { token: admin });
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
