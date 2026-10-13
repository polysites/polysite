import type { Payload } from "payload";

import { modulesOf } from "../plugins/contentTypes";

const ALL_OPERATIONS = {
  create: true,
  read: true,
  update: true,
  delete: true,
  publish: true,
  unpublish: true,
  cloneAcrossSites: true,
};

// The 3 roles this app ships with out of the box. Idempotent -- only
// creates a role whose `name` doesn't already exist, so restarting
// cms never overwrites a Super Admin's later edits to these (a
// Super Admin renaming "Site User" or narrowing its operations is a real,
// expected admin action, not something a redeploy should silently revert).
// A function, not a constant: the module list includes those of the installed content-type plugins, which
// are only known once the config has been built.
function defaultRoles(payload: Payload) {
  const modules = modulesOf(payload.config).map((m) => m.value);
  return [
    { name: "Super Admin", isDefaultDeployed: true, modules, operations: ALL_OPERATIONS, manageSiteSettings: true },
    { name: "Site Admin", isDefaultDeployed: true, modules, operations: ALL_OPERATIONS, manageSiteSettings: true },
    {
      name: "Site User",
      isDefaultDeployed: true,
      // Erasing a person's data is a deliberate grant, not a default for every editor.
      modules: modules.filter((m) => m !== "privacy-requests"),
      operations: ALL_OPERATIONS,
      manageSiteSettings: false,
    },
  ];
}

export async function seedDefaultRoles(payload: Payload): Promise<void> {
  for (const role of defaultRoles(payload)) {
    const { totalDocs } = await payload.find({
      collection: "roles",
      where: { name: { equals: role.name } },
      limit: 0,
      overrideAccess: true,
    });
    if (totalDocs > 0) continue;
    await payload.create({
      collection: "roles",
      data: role as never,
      overrideAccess: true,
    });
  }
}
