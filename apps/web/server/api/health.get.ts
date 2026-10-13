// Liveness for the container health check and monitors. It does not call the CMS: the public site keeps serving its
// cached and static pages when the CMS is down, so the web container should not be reported broken for that.
export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store");
  return { status: "ok", version: process.env.POLYSITE_VERSION || "dev" };
});
