// Writes the page's language and reading direction onto <html lang dir> as the very last step of rendering.
//
// The SEO modules in this app also write <html lang> (from the site configuration's default), and the head library merges
// their value over any a page sets, so the page cannot reliably win from inside the render. app.vue records the language on the
// request instead (event.context.polysiteLanguage), and this replaces the two attributes in the finished markup. A request that
// recorded nothing (an API call, an error before the app ran) is left alone.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    const language = event.context.polysiteLanguage as { code?: string; dir?: string } | undefined;
    const code = language?.code;
    // Codes come from the site's own settings, but nothing unchecked is written into markup.
    if (!code || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code)) return;
    const dir = language?.dir === "rtl" ? "rtl" : "ltr";
    html.htmlAttrs = [...html.htmlAttrs.filter((attr) => !/^\s*(lang|dir)=/i.test(attr)), `lang="${code}"`, `dir="${dir}"`];
  });
});
