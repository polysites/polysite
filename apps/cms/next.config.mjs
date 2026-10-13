import path from "path";

import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Plugins live in /repo/plugins, outside this app, and can ship admin UI
  // (e.g. the notifications bell) that Payload's import map pulls in by
  // relative path. Turbopack refuses to bundle files outside its root, so the
  // root is widened to the repo root (apps/cms is always /repo/apps/cms, in
  // dev, in the production image, and on the server -- see the Dockerfile).
  // After changing this, delete apps/cms/.next: a stale cache keeps serving the
  // old "Module not found" until it's cleared.
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
    // Plugin admin components live outside this app, so they cannot find Payload's UI package on their own.
    resolveAlias: { "@payloadcms/ui": "./node_modules/@payloadcms/ui" },
  },
};

export default withPayload(nextConfig);
