// Used by scripts/pluginMigrations.sh. Usage: node scripts/comparePluginSnapshots.mjs <core.json> <plugin.json> <all.json>
//
// <plugin.json> is the schema of "the core plus this one plugin"; <all.json> is the schema of "the core plus every plugin". The tables
// and enums the plugin adds must be IDENTICAL in both. If they differ, the plugin's own tables depend on what else is installed (for
// example a `select` whose options are built from other plugins' collections becomes a database enum that changes when another plugin
// comes or goes), and its migration would be wrong for some installs. Prints one line per difference and exits 1 if there is any.
import fs from "node:fs";

const [corePath, pluginPath, allPath] = process.argv.slice(2);
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const core = read(corePath);
const plugin = read(pluginPath);
const all = read(allPath);

// ids and prevId differ on every snapshot; indexes/foreign keys are compared like everything else.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const problems = [];
for (const [name, table] of Object.entries(plugin.tables ?? {})) {
  if (core.tables?.[name]) continue; // a core table: the other checks guard it
  if (!all.tables?.[name]) problems.push(`table ${name} is missing when every plugin is installed`);
  else if (!same(table, all.tables[name])) problems.push(`table ${name} looks different when other plugins are installed`);
}
for (const [name, def] of Object.entries(plugin.enums ?? {})) {
  if (core.enums?.[name]) continue;
  if (!all.enums?.[name]) problems.push(`type ${name} is missing when every plugin is installed`);
  else if (!same(def, all.enums[name])) problems.push(`type ${name} has different values when other plugins are installed`);
}

for (const p of problems) console.log(p);
process.exit(problems.length ? 1 : 0);
