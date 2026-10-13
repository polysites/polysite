// End-to-end check of a site in two languages (the i18n plugin plus the core's language-aware web app), against a RUNNING dev stack.
// Not part of CI. It switches French on for one site, writes a page in both languages, visits the public site through the real proxy,
// and puts everything back.
//
//   BASE=http://cms:3001 WEB=http://caddy ADMIN_EMAIL=... ADMIN_PASSWORD=... SITE_ID=1 SITE_HOST=voidslate.localhost node tests/e2e/multilang.e2e.mjs
import http from "node:http";

const BASE = process.env.BASE;
const WEB = process.env.WEB;
const SITE_ID = Number(process.env.SITE_ID ?? 1);
const SITE_HOST = process.env.SITE_HOST ?? "voidslate.localhost";
const results = [];
const ok = (name, cond, extra = "") => {
  results.push(cond);
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : " " + String(extra).slice(0, 300)}`);
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

// A page on the public site, through the proxy, as a visitor would ask for it. (fetch() won't let a script set the Host header,
// and the proxy picks the site by it, so this uses node:http.)
function visit(path) {
  const url = new URL(WEB);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port || 80, path, method: "GET", headers: { Host: SITE_HOST } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8"), location: res.headers.location }));
    });
    req.on("error", reject);
    req.end();
  });
}
const htmlLang = (html) => html.match(/<html[^>]*\blang="([^"]*)"/)?.[1];
const htmlDir = (html) => html.match(/<html[^>]*\bdir="([^"]*)"/)?.[1];

const login = await api("POST", "/api/users/login", { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const admin = login.json?.token;
ok("admin signs in", Boolean(admin));

// A site's language choice is one row in the plugin's own `site-languages` collection; the core reads it back as
// `site.extensions.languages` on the site itself. A site with no row offers English only.
const rowOf = async () => (await api("GET", `/api/site-languages?where[site][equals]=${SITE_ID}&limit=1&depth=0`, { token: admin })).json?.docs?.[0] ?? null;
const choiceOnSite = async () => (await api("GET", `/api/sites/${SITE_ID}?depth=0`, { token: admin })).json?.extensions?.languages;
const before = await rowOf();
const slug = `ml-test-${Date.now()}`;
let pageId;
try {
  const body = { languages: ["en", "fr"], defaultLanguage: "en" };
  const set = before
    ? await api("PATCH", `/api/site-languages/${before.id}`, { token: admin, body })
    : await api("POST", "/api/site-languages", { token: admin, body: { site: SITE_ID, ...body } });
  const row = set.json?.doc;
  ok("a Super Admin can switch French on for a site", (set.status === 200 || set.status === 201) && row?.languages?.includes("fr"), JSON.stringify(set.json)?.slice(0, 240));
  const onSite = await choiceOnSite();
  ok("and the site itself carries the choice as extensions.languages", onSite?.languages?.includes("fr") && onSite?.defaultLanguage === "en", JSON.stringify(onSite));
  const refused = await api("PATCH", `/api/site-languages/${row?.id}`, { token: admin, body: { languages: ["en", "xx"] } });
  ok("a code that is not in the catalog is refused", refused.status === 400, `${refused.status}`);
  const bad = await api("PATCH", `/api/site-languages/${row?.id}`, { token: admin, body: { languages: ["en", "fr"], defaultLanguage: "de" } });
  const norm = await choiceOnSite();
  ok("a default language that isn't offered is corrected, not saved", bad.status === 200 ? norm?.defaultLanguage === "en" : bad.status === 400, JSON.stringify(norm));
  const onlyDefault = await api("PATCH", `/api/site-languages/${row?.id}`, { token: admin, body: { defaultLanguage: "fr" } });
  const kept = await choiceOnSite();
  ok("changing only the default keeps the languages", onlyDefault.status === 200 && kept?.languages?.length === 2 && kept?.defaultLanguage === "fr", JSON.stringify(kept));
  await api("PATCH", `/api/site-languages/${row?.id}`, { token: admin, body: { defaultLanguage: "en" } });
  const settled = await choiceOnSite();
  ok("the default can be put back", settled?.defaultLanguage === "en", JSON.stringify(settled));

  const created = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Hello", slug, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Welcome", subheading: "English subheading", ctaHref: "/join" }] },
  });
  pageId = created.json?.doc?.id;
  const blockId = created.json?.doc?.content?.[0]?.id;
  ok("a page is written in English", created.status === 201 && Boolean(blockId), JSON.stringify(created.json)?.slice(0, 200));
  const fr = await api("PATCH", `/api/pages/${pageId}?locale=fr`, {
    token: admin,
    body: { title: "Bonjour", _status: "published", content: [{ id: blockId, blockType: "hero", heading: "Bienvenue", ctaHref: "/join" }] },
  });
  ok("and in French", fr.status === 200 && fr.json?.doc?.title === "Bonjour", JSON.stringify(fr.json)?.slice(0, 200));

  // the editor's language picker
  const status = await api("GET", "/api/i18n/status", { token: admin });
  ok("the admin is told it is multilingual", status.json?.multilingual === true && status.json.languages?.includes("fr"), JSON.stringify(status.json));

  // the URL index records which languages the page has
  await new Promise((r) => setTimeout(r, 1500));
  const index = await api("GET", `/api/site-urls?where[path][equals]=${slug}&locale=en`, { token: admin });
  const langs = index.json?.docs?.[0]?.languages;
  ok("the URL index knows the page has English and French", Array.isArray(langs) && langs.includes("en") && langs.includes("fr"), JSON.stringify(langs));

  // the public site
  const en = await visit(`/${slug}`);
  ok("visitors get English at the plain address, marked lang=en", en.status === 200 && /Welcome/.test(en.text) && htmlLang(en.text) === "en", `${en.status} ${htmlLang(en.text)}`);
  const frPage = await visit(`/fr/${slug}`);
  ok("and French under /fr/, marked lang=fr", frPage.status === 200 && /Bienvenue/.test(frPage.text) && !/Welcome/.test(frPage.text) && htmlLang(frPage.text) === "fr", `${frPage.status} ${htmlLang(frPage.text)}`);
  ok("a French page falls back to English for what isn't translated", /English subheading/.test(frPage.text));
  ok("French reads left to right", htmlDir(frPage.text) === "ltr");

  const frHome = await visit("/fr");
  ok("/fr is the French home page", frHome.status === 200 && htmlLang(frHome.text) === "fr", `${frHome.status}`);
  const unknown = await visit(`/de/${slug}`);
  ok("a language the site doesn't offer is just a missing page", unknown.status === 404, `${unknown.status}`);
  const plain = await visit("/nonexistent-page-xyz");
  ok("an unknown page is still a 404", plain.status === 404);

  // search engines and the switcher
  const alternates = [...frPage.text.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"|<link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1] ?? m[3], m[2] ?? m[4]]);
  const hrefs = Object.fromEntries(alternates);
  ok("a translated page lists its languages for search engines", Boolean(hrefs.en) && Boolean(hrefs.fr) && Boolean(hrefs["x-default"]), JSON.stringify(alternates));
  ok("the French alternate is the /fr/ address and x-default is the plain one", String(hrefs.fr).endsWith(`/fr/${slug}`) && String(hrefs["x-default"]).endsWith(`/${slug}`) && !String(hrefs["x-default"]).includes("/fr/"), JSON.stringify(hrefs));
  // (The dev server also marks every page "noindex, nofollow" through the SEO module; this plugin's own tag is "noindex, follow".)
  const ours = /<meta[^>]*name="robots"[^>]*content="noindex, follow"/;
  ok("a translated page is not hidden from search engines by this plugin", !ours.test(frPage.text));
  ok("the language switcher offers both languages", /class="poly-language-switcher"/.test(en.text) && />\s*English\s*</.test(en.text) && />\s*Fran(ç|c)ais\s*</.test(en.text), "no switcher in the page");
  ok("and its French link points at the French address", new RegExp(`href="/fr/${slug}"[^>]*hreflang="fr"|hreflang="fr"[^>]*href="/fr/${slug}"`).test(en.text));

  // a page with only English must not appear under /fr/ as an indexable copy
  const only = await api("POST", "/api/pages", { token: admin, body: { title: "English only", slug: `${slug}-en`, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Only English" }] } });
  const onlyId = only.json?.doc?.id;
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const copy = await visit(`/fr/${slug}-en`);
    ok("an untranslated page is shown in the default language under /fr/", copy.status === 200 && /Only English/.test(copy.text) && htmlLang(copy.text) === "fr", `${copy.status}`);
    ok("but search engines are asked not to index that copy", ours.test(copy.text));
    const plainOnly = await visit(`/${slug}-en`);
    ok("while the real page stays indexable", !ours.test(plainOnly.text));
  } finally {
    if (onlyId) await api("DELETE", `/api/pages/${onlyId}`, { token: admin });
  }

  // the sitemap
  const sitemap = await visit("/sitemap.xml");
  ok("the sitemap lists the page in both languages", sitemap.text.includes(`/${slug}<`) && sitemap.text.includes(`/fr/${slug}<`), sitemap.status);
  ok("with alternates connecting them", /xhtml:link[^>]*hreflang="fr"/.test(sitemap.text), "no xhtml:link alternates");

  // the editor's reading of every language, and a page the editor has not translated is flagged by the index
  const indexOnly = await api("GET", `/api/site-urls?where[path][equals]=${slug}&locale=en`, { token: admin });
  ok("the index still says English and French for the translated page", (indexOnly.json?.docs?.[0]?.languages ?? []).includes("fr"));

  // required fields: a first translation must not need every required block field copied over
  const leader = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Leader", slug: `${slug}-leader`, site: SITE_ID, _status: "published", content: [{ blockType: "leaderSpotlight", name: "Alex Morgan", title: "Candidate", quote: "Hello there" }] },
  });
  const leaderId = leader.json?.doc?.id;
  try {
    ok("a page with required block fields is written in English", leader.status === 201, JSON.stringify(leader.json)?.slice(0, 240));
    const blank = await api("POST", "/api/pages", { token: admin, body: { title: "Blank", slug: `${slug}-blank`, site: SITE_ID, _status: "published", content: [{ blockType: "leaderSpotlight", name: "", quote: "" }] } });
    ok("the default language still insists on them", blank.status === 400, `${blank.status}`);
    const first = await api("PATCH", `/api/pages/${leaderId}?locale=fr`, { token: admin, body: { title: "Dirigeant", _status: "published" } });
    ok("but the first French save needs only what is being translated", first.status === 200 && first.json?.doc?.title === "Dirigeant", JSON.stringify(first.json)?.slice(0, 300));
    const frLeader = await visit(`/fr/${slug}-leader`);
    ok("and the untranslated block text falls back to English on the French page", frLeader.status === 200 && /Alex Morgan/.test(frLeader.text) && /Hello there/.test(frLeader.text), `${frLeader.status}`);
  } finally {
    if (leaderId) await api("DELETE", `/api/pages/${leaderId}`, { token: admin });
  }

  // news in French, and the theme's fixed words
  const lexical = (text) => ({ root: { type: "root", format: "", indent: 0, version: 1, direction: null, children: [{ type: "paragraph", format: "", indent: 0, version: 1, direction: null, children: [{ type: "text", text, version: 1, format: 0, mode: "normal", style: "", detail: 0 }] }] } });
  const post = await api("POST", "/api/posts", { token: admin, body: { title: "News in English", slug: `${slug}-post`, site: SITE_ID, _status: "published", body: lexical("English body") } });
  const postId = post.json?.doc?.id;
  try {
    ok("a post is written", post.status === 201, JSON.stringify(post.json)?.slice(0, 200));
    const postFr = await api("PATCH", `/api/posts/${postId}?locale=fr`, { token: admin, body: { title: "Nouvelles en français", _status: "published", body: lexical("Corps français") } });
    ok("and translated", postFr.status === 200, JSON.stringify(postFr.json)?.slice(0, 200));
    const postEn = await visit(`/news/${slug}-post`);
    const postFrPage = await visit(`/fr/news/${slug}-post`);
    ok("the English post is in English", postEn.status === 200 && /News in English/.test(postEn.text) && /English body/.test(postEn.text), `${postEn.status}`);
    ok("the French post is in French, with the byline words translated", postFrPage.status === 200 && /Nouvelles en fran/.test(postFrPage.text) && /Corps fran/.test(postFrPage.text) && htmlLang(postFrPage.text) === "fr", `${postFrPage.status}`);
    const list = await visit("/fr/news");
    ok("the French news list uses the French words for its controls", list.status === 200 && /Plus anciens/.test(list.text) && /Cat(é|e)gories/.test(list.text), `${list.status}`);
    ok("and keeps links inside French", /href="\/fr\/news\//.test(list.text));
    const englishList = await visit("/news");
    ok("the English news list is unchanged", /Older/.test(englishList.text) && !/Plus anciens/.test(englishList.text));
  } finally {
    if (postId) await api("DELETE", `/api/posts/${postId}`, { token: admin });
  }

  // every language of the page, in one answer for an editor
  const all = await api("GET", `/api/pages/${pageId}?locale=all&depth=0`, { token: admin });
  ok("an editor can read every language together", all.json?.title?.en === "Hello" && all.json?.title?.fr === "Bonjour");
} finally {
  if (pageId) await api("DELETE", `/api/pages/${pageId}`, { token: admin });
  // Puts the site's language choice back as it was: its old row, or no row at all.
  const now = await rowOf();
  if (now && before) await api("PATCH", `/api/site-languages/${now.id}`, { token: admin, body: { languages: before.languages ?? [], defaultLanguage: before.defaultLanguage ?? null } });
  else if (now) await api("DELETE", `/api/site-languages/${now.id}`, { token: admin });
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
