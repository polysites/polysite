// End-to-end check of the translation extras (language live / preview only, translated addresses, the machine-translation helper)
// against a RUNNING dev stack. Not part of CI. It changes one site's language row, writes a page, and puts everything back.
//
//   BASE=http://cms:3001 WEB=http://caddy WEB_DIRECT=http://web:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... SITE_ID=1 SITE_HOST=voidslate.localhost REVALIDATE_SECRET=... node tests/e2e/multilang-extras.e2e.mjs
import { createHmac } from "node:crypto";
import http from "node:http";

const BASE = process.env.BASE;
const WEB = process.env.WEB;
const SITE_ID = Number(process.env.SITE_ID ?? 1);
const SITE_HOST = process.env.SITE_HOST ?? "voidslate.localhost";
const WEB_DIRECT = process.env.WEB_DIRECT ?? "http://web:3000"; // the web app itself: Caddy sends /api/ to the CMS
const SECRET = process.env.REVALIDATE_SECRET ?? "";
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

// As a visitor would ask, through the proxy (fetch() cannot set Host, which picks the site).
function visit(path, host = SITE_HOST, base = WEB) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port || 80, path, method: "GET", headers: { Host: host } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8"), headers: res.headers, location: res.headers.location }));
    });
    req.on("error", reject);
    req.end();
  });
}
const htmlLang = (html) => html.match(/<html[^>]*\blang="([^"]*)"/)?.[1];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The same signing as apps/web/utils/previewLanguage.ts.
const previewToken = (host, language, expires = Math.floor(Date.now() / 1000) + 3600, secret = SECRET) =>
  `${language}.${expires}.${createHmac("sha256", secret).update(`polysite-language-preview|${host.toLowerCase()}|${language}|${expires}`).digest("hex")}`;

const login = await api("POST", "/api/users/login", { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const admin = login.json?.token;
ok("admin signs in", Boolean(admin));

const rowOf = async () => (await api("GET", `/api/site-languages?where[site][equals]=${SITE_ID}&limit=1&depth=0`, { token: admin })).json?.docs?.[0] ?? null;
const before = await rowOf();
const slug = `mlx-test-${Date.now()}`;
let pageId;
try {
  const body = { languages: ["en", "fr", "ar"], defaultLanguage: "en", previewLanguages: [] };
  const set = before
    ? await api("PATCH", `/api/site-languages/${before.id}`, { token: admin, body })
    : await api("POST", "/api/site-languages", { token: admin, body: { site: SITE_ID, ...body } });
  const row = set.json?.doc;
  ok("a site offers English, French and Arabic", (set.status === 200 || set.status === 201) && row?.languages?.length === 3, JSON.stringify(set.json)?.slice(0, 200));

  const created = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Hello", slug, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Welcome", subheading: "English subheading" }] },
  });
  pageId = created.json?.doc?.id;
  const blockId = created.json?.doc?.content?.[0]?.id;
  ok("a page is written in English", created.status === 201 && Boolean(blockId), JSON.stringify(created.json)?.slice(0, 200));
  for (const [code, title, heading] of [
    ["fr", "Bonjour", "Bienvenue"],
    ["ar", "مرحبا", "أهلا بكم"],
  ]) {
    const tr = await api("PATCH", `/api/pages/${pageId}?locale=${code}`, { token: admin, body: { title, _status: "published", content: [{ id: blockId, blockType: "hero", heading }] } });
    ok(`and in ${code}`, tr.status === 200, JSON.stringify(tr.json)?.slice(0, 200));
  }
  await wait(1500);

  // ---- L4: a language that is live or preview only
  const live = await visit(`/ar/${slug}`);
  ok("with every language live, Arabic is served, right to left", live.status === 200 && htmlLang(live.text) === "ar" && /dir="rtl"/.test(live.text), `${live.status}`);

  const hide = await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { previewLanguages: ["ar"] } });
  ok("a Super Admin can set Arabic to preview only", hide.status === 200 && hide.json?.doc?.previewLanguages?.includes("ar"), JSON.stringify(hide.json)?.slice(0, 200));
  const refuse = await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { previewLanguages: ["en"] } });
  const keep = await api("GET", `/api/site-languages/${row.id}?depth=0`, { token: admin });
  ok("the default language cannot be preview only", refuse.status === 200 ? !keep.json?.previewLanguages?.includes("en") : refuse.status === 400, `${refuse.status}`);
  await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { previewLanguages: ["ar"] } });
  const onSite = (await api("GET", `/api/sites/${SITE_ID}?depth=0`, { token: admin })).json?.extensions?.languages;
  ok("the site carries it as extensions.languages.previewLanguages", onSite?.previewLanguages?.includes("ar") && onSite?.languages?.includes("ar"), JSON.stringify(onSite));
  const editorStatus = await api("GET", "/api/i18n/status", { token: admin });
  ok("editors can still write in it", editorStatus.json?.languages?.includes("ar"), JSON.stringify(editorStatus.json));
  await wait(1500);

  const hidden = await visit(`/ar/${slug}`);
  ok("visitors get a 404 at the preview-only language's address", hidden.status === 404, `${hidden.status}`);
  const fr = await visit(`/fr/${slug}`);
  ok("the live language is unaffected", fr.status === 200 && htmlLang(fr.text) === "fr", `${fr.status}`);
  ok("and does not mention the hidden one (hreflang, switcher)", !/hreflang="ar"/.test(fr.text) && /hreflang="fr"/.test(fr.text));
  const urls = await visit("/api/__sitemap__/urls", SITE_HOST, WEB_DIRECT);
  ok("the sitemap lists no address in it", urls.status === 200 && !urls.text.includes(`/ar/${slug}`) && urls.text.includes(`/fr/${slug}`), `${urls.status}`);

  const opened = await visit(`/ar/${slug}?_pl=${previewToken(SITE_HOST, "ar")}`);
  ok("a signed preview link opens it", opened.status === 200 && htmlLang(opened.text) === "ar" && opened.text.includes("أهلا بكم"), `${opened.status}`);
  ok("and the page is never cached or indexed", /no-store/.test(String(opened.headers["cache-control"])) && /noindex/.test(opened.text), String(opened.headers["cache-control"]));
  const stillHidden = await visit(`/ar/${slug}`);
  ok("the same address without the link is still a 404 (nothing leaked into the page cache)", stillHidden.status === 404, `${stillHidden.status}`);
  for (const [name, token] of [
    ["another site's", previewToken("other.localhost", "ar")],
    ["an expired", previewToken(SITE_HOST, "ar", Math.floor(Date.now() / 1000) - 10)],
    ["a forged", previewToken(SITE_HOST, "ar", undefined, "not-the-secret")],
    ["a token for another language's", previewToken(SITE_HOST, "fr")],
  ]) {
    const r = await visit(`/ar/${slug}?_pl=${token}`);
    ok(`${name} link does not open it`, r.status === 404, `${r.status}`);
  }

  const show = await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { previewLanguages: [] } });
  await wait(1500);
  const back = await visit(`/ar/${slug}`);
  ok("taking it out of the list puts it live", show.status === 200 && back.status === 200 && htmlLang(back.text) === "ar", `${back.status}`);

  // ---- L5: the machine-translation helper (the server must run with POLYSITE_TRANSLATE_PROVIDER=echo)
  const mtSlug = slug + "-mt";
  const mt = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Machine page", slug: mtSlug, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Machine heading", subheading: "Machine subheading", ctaHref: "/join" }] },
  });
  const mtId = mt.json?.doc?.id;
  try {
    ok("a page for the helper is written in English", mt.status === 201 && Boolean(mtId), JSON.stringify(mt.json)?.slice(0, 200));
    await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { translationEnabled: false } });
    const off = await api("GET", `/api/i18n/translate/status?collection=pages&id=${mtId}`, { token: admin });
    ok("the helper is off until the site switches it on", off.json?.available === false && /switched off/.test(off.json?.reason ?? ""), JSON.stringify(off.json));
    const refused = await api("POST", "/api/i18n/translate", { token: admin, body: { collection: "pages", id: mtId, to: "fr" } });
    ok("and a translate request is refused while it is off", refused.status === 409, `${refused.status}`);
    const anon = await api("POST", "/api/i18n/translate", { body: { collection: "pages", id: mtId, to: "fr" } });
    ok("nobody who is signed out can use it", anon.status === 401, `${anon.status}`);
    await api("PATCH", `/api/site-languages/${row.id}`, { token: admin, body: { translationEnabled: true } });
    const on = await api("GET", `/api/i18n/translate/status?collection=pages&id=${mtId}`, { token: admin });
    ok("switched on, it offers the other languages of the site", on.json?.available === true && on.json.languages?.includes("fr") && on.json.from === "en", JSON.stringify(on.json));
    const publicSite = JSON.stringify((await api("GET", `/api/sites?where[id][equals]=${SITE_ID}&depth=0`)).json ?? {});
    ok("the switch is not part of what visitors can read", !publicSite.includes("translationEnabled"));

    const done = await api("POST", "/api/i18n/translate", { token: admin, body: { collection: "pages", id: mtId, to: "fr" } });
    ok("an editor translates the page into French", done.status === 200 && done.json?.translated >= 3, JSON.stringify(done.json));
    const draft = await api("GET", `/api/pages/${mtId}?locale=fr&fallback-locale=none&draft=true&depth=0`, { token: admin });
    ok("the French text is saved as a draft", draft.json?.title === "[fr] Machine page" && draft.json?.content?.[0]?.heading === "[fr] Machine heading", JSON.stringify(draft.json?.title));
    ok("shared fields are untouched", draft.json?.content?.[0]?.ctaHref === "/join" && draft.json?.slug === mtSlug);
    await wait(1500);
    const live2 = await visit(`/fr/${mtSlug}`);
    ok("visitors still see no machine text", !live2.text.includes("[fr]"), `${live2.status}`);
    const again = await api("POST", "/api/i18n/translate", { token: admin, body: { collection: "pages", id: mtId, to: "fr" } });
    ok("translating again does not overwrite what is there", again.status === 200 && again.json?.translated === 0, JSON.stringify(again.json));
    const unrev = await api("GET", `/api/i18n/translate/status?collection=pages&id=${mtId}`, { token: admin });
    ok("French is listed as waiting for review", unrev.json?.unreviewed?.includes("fr"), JSON.stringify(unrev.json));
    const blocked = await api("PATCH", `/api/pages/${mtId}`, { token: admin, body: { _status: "published" } });
    ok("the page cannot be published until it is reviewed", blocked.status === 400 && JSON.stringify(blocked.json).includes("not been reviewed"), `${blocked.status} ${JSON.stringify(blocked.json)?.slice(0, 200)}`);
    const bad = await api("POST", "/api/i18n/translate", { token: admin, body: { collection: "pages", id: mtId, to: "de" } });
    ok("a language the site does not offer is refused", bad.status === 400, `${bad.status}`);
    const rev = await api("POST", "/api/i18n/translate/review", { token: admin, body: { collection: "pages", id: mtId, locale: "fr" } });
    ok("marking it reviewed works", rev.status === 200 && rev.json?.reviewed === true, JSON.stringify(rev.json));
    const pub = await api("PATCH", `/api/pages/${mtId}`, { token: admin, body: { _status: "published" } });
    ok("and then the page can be published", pub.status === 200, `${pub.status} ${JSON.stringify(pub.json)?.slice(0, 200)}`);
    await wait(1500);
    const live3 = await visit(`/fr/${mtSlug}`);
    ok("visitors now see the reviewed French", live3.status === 200 && live3.text.includes("[fr] Machine heading"), `${live3.status}`);
  } finally {
    if (mtId) await api("DELETE", `/api/pages/${mtId}`, { token: admin });
  }

  // ---- L3: a page's address in each language
  const ts = Date.now();
  const frAddress = `a-propos-${ts}`;
  const frAddress2 = `a-propos-nous-${ts}`;
  const arAddress = `من-نحن-${ts}`;
  const addr = await api("POST", "/api/pages", {
    token: admin,
    body: { title: "Address page", slug: `${slug}-addr`, site: SITE_ID, _status: "published", content: [{ blockType: "hero", heading: "Address heading" }] },
  });
  const addrId = addr.json?.doc?.id;
  const addrBlock = addr.json?.doc?.content?.[0]?.id;
  const sharedSlug = `${slug}-addr`;
  const second = await api("POST", "/api/pages", { token: admin, body: { title: "Second", slug: `${slug}-second`, site: SITE_ID, _status: "published", content: [] } });
  const secondId = second.json?.doc?.id;
  try {
    ok("a page for the address checks is written", addr.status === 201 && Boolean(addrId), JSON.stringify(addr.json)?.slice(0, 200));
    const setFr = await api("PATCH", `/api/pages/${addrId}?locale=fr`, { token: admin, body: { title: "Page d'adresse", translatedSlug: frAddress, _status: "published", content: [{ id: addrBlock, blockType: "hero", heading: "Titre français" }] } });
    ok("an editor gives the page its own French address", setFr.status === 200 && setFr.json?.doc?.translatedSlug === frAddress, JSON.stringify(setFr.json)?.slice(0, 200));
    const setAr = await api("PATCH", `/api/pages/${addrId}?locale=ar`, { token: admin, body: { title: "صفحة", translatedSlug: ` ${arAddress.toUpperCase()} `, _status: "published", content: [{ id: addrBlock, blockType: "hero", heading: "عنوان" }] } });
    ok("and an Arabic one, in Arabic letters", setAr.status === 200 && setAr.json?.doc?.translatedSlug === arAddress, JSON.stringify(setAr.json?.doc?.translatedSlug));
    await wait(2000);

    const own = await visit(`/fr/${frAddress}`);
    ok("the page is served at its French address", own.status === 200 && own.text.includes("Titre français") && htmlLang(own.text) === "fr", `${own.status}`);
    const arOwn = await visit(`/ar/${encodeURIComponent(arAddress)}`);
    ok("and at its Arabic address", arOwn.status === 200 && arOwn.text.includes("عنوان"), `${arOwn.status}`);
    const old = await visit(`/fr/${sharedSlug}`);
    ok("the shared address still works in French: it sends visitors on to the French address", old.status === 301 && old.location === `/fr/${frAddress}`, `${old.status} ${old.location}`);
    const enAddr = await visit(`/${sharedSlug}`);
    ok("English keeps the shared address", enAddr.status === 200 && enAddr.text.includes("Address heading"), `${enAddr.status}`);
    const enOther = await visit(`/${frAddress}`);
    ok("and the French address means nothing in English", enOther.status === 404, `${enOther.status}`);
    const enOnLang = await visit(`/ar/${frAddress}`);
    ok("or in another language", enOnLang.status === 404, `${enOnLang.status}`);

    const alt = Object.fromEntries([...enAddr.text.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"|<link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1] ?? m[3], m[2] ?? m[4]]));
    ok("search engines are told each language's own address", String(alt.fr).endsWith(`/fr/${frAddress}`) && decodeURIComponent(String(alt.ar)).endsWith(`/ar/${arAddress}`) && String(alt.en).endsWith(`/${sharedSlug}`), JSON.stringify(alt));
    ok("the switcher links to the French address", new RegExp(`href="/fr/${frAddress}"`).test(enAddr.text), "no link");
    const fromFr = await visit(`/fr/${frAddress}`);
    ok("and the French page's switcher links back to the English address", new RegExp(`href="/${sharedSlug}"`).test(fromFr.text), "no link");
    const urls = await visit("/api/__sitemap__/urls", SITE_HOST, WEB_DIRECT);
    ok("the sitemap lists the French address, not the old shared one under /fr/", urls.text.replace(/\s+/g, "").includes(`"loc":"/fr/${frAddress}"`) && !urls.text.replace(/\s+/g, "").includes(`"loc":"/fr/${sharedSlug}"`), `${urls.status} ${urls.text.split(String.fromCharCode(10)).filter((l) => l.includes(String(ts))).slice(0, 8).join(" ")}`);

    const dup = await api("PATCH", `/api/pages/${secondId}?locale=fr`, { token: admin, body: { translatedSlug: frAddress } });
    ok("two pages cannot have the same address in a language", dup.status === 400, `${dup.status}`);
    const clash = await api("PATCH", `/api/pages/${secondId}?locale=fr`, { token: admin, body: { translatedSlug: sharedSlug } });
    ok("nor take another page's shared address", clash.status === 400, `${clash.status}`);
    const dflt = await api("PATCH", `/api/pages/${secondId}?locale=en`, { token: admin, body: { translatedSlug: "something" } });
    ok("the default language has no translated address", dflt.status === 400, `${dflt.status}`);
    const code = await api("PATCH", `/api/pages/${secondId}?locale=fr`, { token: admin, body: { translatedSlug: "ar" } });
    ok("a language code cannot be an address", code.status === 400, `${code.status}`);

    const rename = await api("PATCH", `/api/pages/${addrId}?locale=fr`, { token: admin, body: { translatedSlug: frAddress2, _status: "published" } });
    ok("the French address can be changed", rename.status === 200 && rename.json?.doc?.translatedSlug === frAddress2, `${rename.status}`);
    await wait(2000);
    const renamedOld = await visit(`/fr/${frAddress}`);
    ok("the old French address now redirects to the new one", renamedOld.status === 301 && renamedOld.location === `/fr/${frAddress2}`, `${renamedOld.status} ${renamedOld.location}`);
    const renamedNew = await visit(`/fr/${frAddress2}`);
    ok("and the new one is served", renamedNew.status === 200 && renamedNew.text.includes("Titre français"), `${renamedNew.status}`);
    const sharedAfter = await visit(`/fr/${sharedSlug}`);
    ok("the shared address follows the rename too", sharedAfter.status === 301 && sharedAfter.location === `/fr/${frAddress2}`, `${sharedAfter.status} ${sharedAfter.location}`);

    const clear = await api("PATCH", `/api/pages/${addrId}?locale=fr`, { token: admin, body: { translatedSlug: "", _status: "published" } });
    await wait(2000);
    const cleared = await visit(`/fr/${frAddress2}`);
    ok("clearing it goes back to the shared address, and the old one redirects there", clear.status === 200 && cleared.status === 301 && cleared.location === `/fr/${sharedSlug}`, `${clear.status} ${cleared.status} ${cleared.location}`);
    const back = await visit(`/fr/${sharedSlug}`);
    ok("which serves the French page again", back.status === 200 && back.text.includes("Titre français"), `${back.status}`);
  } finally {
    for (const id of [addrId, secondId]) if (id) await api("DELETE", `/api/pages/${id}`, { token: admin });
    // the redirects the renames left behind
    const left = await api("GET", `/api/redirects?where[fromPath][like]=${ts}&limit=20&depth=0`, { token: admin });
    for (const r of left.json?.docs ?? []) await api("DELETE", `/api/redirects/${r.id}`, { token: admin });
  }
} finally {
  if (pageId) await api("DELETE", `/api/pages/${pageId}`, { token: admin });
  const now = await rowOf();
  if (now && before) await api("PATCH", `/api/site-languages/${now.id}`, { token: admin, body: { languages: before.languages ?? [], defaultLanguage: before.defaultLanguage ?? null, previewLanguages: before.previewLanguages ?? [], translationEnabled: before.translationEnabled ?? false } });
  else if (now) await api("DELETE", `/api/site-languages/${now.id}`, { token: admin });
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
