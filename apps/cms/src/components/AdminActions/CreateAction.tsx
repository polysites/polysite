import type { ServerProps } from "payload";

import { CreateActionClient } from "./CreateActionClient";
import { MODULE_ICONS } from "../AdminNav/icons";

// Wired into admin.components.actions (payload.config.ts) -- renders in
// AppHeader's top-right, confirmed via getRouteData.js seeding viewActions
// from this exact config key. A Server Component so it can read the real,
// per-request `permissions` (not a client-guessed capability list) to
// decide which collections actually offer a real "create" button here.
export function CreateAction(props: ServerProps) {
  const { payload, permissions } = props;
  const items = payload.config.collections
    .filter((c) => permissions?.collections?.[c.slug]?.create)
    .filter((c) => MODULE_ICONS[c.slug]) // only the collections this UI actually has an icon/identity for
    .map((c) => ({ slug: c.slug, label: typeof c.labels?.singular === "string" ? c.labels.singular : c.slug }));

  if (items.length === 0) return null;

  return <CreateActionClient items={items} />;
}
