// The server writes <html lang dir> for the page that was asked for (server/plugins/htmlLanguage.ts). In the browser the visitor
// can move to another page of the same site without a reload, so the attributes follow the address.
export default defineNuxtPlugin((nuxtApp) => {
  const apply = () =>
    nuxtApp.runWithContext(() => {
      const { code, dir } = useSiteLanguage();
      document.documentElement.setAttribute("lang", code.value);
      document.documentElement.setAttribute("dir", dir.value);
    });
  nuxtApp.hook("app:mounted", apply);
  nuxtApp.hook("page:finish", apply);
});
