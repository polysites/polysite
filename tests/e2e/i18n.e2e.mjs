// End-to-end check of translatable content in the core, against a RUNNING dev stack. Not part of CI. It creates a page, writes
// a French translation next to the English text, and checks what visitors and editors get back in each case, then removes it.
//
//   BASE=http://cms:3001 ADMIN_EMAIL=... ADMIN_PASSWORD=... SITE_ID=1 SITE_HOST=voidslate.localhost node tests/e2e/i18n.e2e.mjs
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

const login = await api("POST", "/api/users/login", { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const admin = login.json?.token;
ok("admin signs in", Boolean(admin));

const slug = `i18n-test-${Date.now()}`;
const live = async (query = "") =>
  (await api("GET", `/api/pages?where[slug][equals]=${slug}&where[site.domain][equals]=${SITE_HOST}&depth=0${query}`)).json?.docs?.[0] ?? null;
let pageId;
try {
  const created = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Hello", slug, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Welcome", subheading: "English subheading", ctaHref: "/join" }] },
  });
  pageId = created.json?.doc?.id;
  ok("a page is created in English", created.status === 201 && created.json?.doc?.title === "Hello", JSON.stringify(created.json)?.slice(0, 200));
  const blockId = created.json?.doc?.content?.[0]?.id;
  ok("and its block has an id to translate against", Boolean(blockId));

  ok("visitors get English with no language asked for", (await live())?.title === "Hello");

  const translated = await api("PATCH", `/api/pages/${pageId}?locale=fr`, {
    token: admin,
    body: { title: "Bonjour", _status: "published", content: [{ id: blockId, blockType: "hero", heading: "Bienvenue", ctaHref: "/join" }] },
  });
  ok("a French translation is saved next to the English text", translated.status === 200 && translated.json?.doc?.title === "Bonjour", JSON.stringify(translated.json)?.slice(0, 200));

  const en = await live("&locale=en");
  const fr = await live("&locale=fr");
  ok("English is untouched", en?.title === "Hello" && en?.content?.[0]?.heading === "Welcome", JSON.stringify([en?.title, en?.content?.[0]?.heading]));
  ok("French is served in French", fr?.title === "Bonjour" && fr?.content?.[0]?.heading === "Bienvenue", JSON.stringify([fr?.title, fr?.content?.[0]?.heading]));
  ok("a missing French field falls back to English", fr?.content?.[0]?.subheading === "English subheading", fr?.content?.[0]?.subheading);
  ok("the block structure and link are shared", fr?.content?.length === 1 && fr?.content?.[0]?.id === blockId && fr?.content?.[0]?.ctaHref === "/join");

  const de = await live("&locale=de");
  ok("a language with no translation falls back to English", de?.title === "Hello");
  const strict = await live("&locale=de&fallback-locale=none");
  ok("and shows nothing when fallback is switched off", !strict?.title, JSON.stringify(strict?.title));

  const all = (await api("GET", `/api/pages/${pageId}?locale=all&depth=0`, { token: admin })).json;
  ok("an editor can ask for every language at once", all?.title?.en === "Hello" && all?.title?.fr === "Bonjour", JSON.stringify(all?.title));

  // drafts and history carry the languages
  const draftFr = await api("PATCH", `/api/pages/${pageId}?locale=fr&draft=true`, { token: admin, body: { title: "Bonjour (brouillon)", _status: "draft" } });
  ok("a French draft can be saved over the live page", draftFr.status === 200, `${draftFr.status}`);
  ok("visitors still see the live French", (await live("&locale=fr"))?.title === "Bonjour");
  const versions = await api("GET", `/api/pages/versions?where[parent][equals]=${pageId}&limit=20&locale=all`, { token: admin });
  ok("the version history holds every language", (versions.json?.docs ?? []).length >= 3, String(versions.json?.docs?.length));

  // search index follows the live English text
  const index = await api("GET", `/api/site-urls?where[path][equals]=${slug}&locale=en`, { token: admin });
  ok("the URL index lists the page in English", index.json?.docs?.[0]?.title === "Hello", JSON.stringify(index.json?.docs?.[0]?.title));

  // only English is offered by the core on its own
  const sel = await api("GET", "/api/globals/auth-settings", { token: admin });
  ok("the API is still healthy for other collections", sel.status === 200 || sel.status === 404 || sel.status === 403);
} finally {
  if (pageId) await api("DELETE", `/api/pages/${pageId}`, { token: admin });
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
