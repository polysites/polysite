// Puts the admin's origin into the Content-Security-Policy's frame-ancestors, so Live Preview can show the site in the admin's frame.
// Done at run time, on the way out, replacing what nuxt-security wrote (which only knows the site itself) rather than adding a
// second header. The environment is read once per process. See server/utils/frameAncestors.ts.
import { adminOrigin, withFrameAncestors } from "../utils/frameAncestors";

const origin = adminOrigin();

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event) => {
    const csp = getResponseHeader(event, "content-security-policy");
    if (typeof csp === "string" && csp) setResponseHeader(event, "Content-Security-Policy", withFrameAncestors(csp, origin));
  });
});
