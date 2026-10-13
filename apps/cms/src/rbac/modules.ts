// The single place a collection gets registered into the dynamic RBAC
// system. A Roles document's `modules` field options are derived from this
// list -- adding a future collection (e.g. Events) here is the only code
// change needed; from that point on its permissions are pure data, set by a
// Super Admin through the Roles admin UI, not by editing access functions.
//
// This is the core's own list. A content-type plugin declares its module on its
// collections (plugins/contentTypes.ts), and the lists the admin shows (Roles ->
// Modules, Sites -> Enabled Modules) and the default roles include it whenever
// that plugin is installed, and not otherwise.
export const RBAC_MODULES = [
  { label: "Pages", value: "pages" },
  { label: "Media", value: "media" },
  { label: "Forms", value: "forms" },
  { label: "Form Submissions", value: "form-submissions" },
  { label: "Privacy Requests", value: "privacy-requests" },
  { label: "Redirects", value: "redirects" },
] as const;

export interface RbacModuleOption {
  label: string;
  value: string;
}

export type RbacModule = string;
