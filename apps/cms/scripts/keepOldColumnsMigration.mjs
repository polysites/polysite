// Usage (inside the CMS container, after `payload migrate:create <name>` made a migration that turns fields translatable):
//   node scripts/keepOldColumnsMigration.mjs src/migrations/<timestamp>_<name>.ts
// See Known Issue #62 in docs/ARCHITECTURE.md for why the generated migration must not be used as it is.
// Turns Payload's generated "make these fields translatable" migration into one that keeps every value.
// The generator creates the per-language tables and DROPS the old columns, which would delete all existing text.
// This script: (1) copies each old column into the English row of the new table, then (2) turns every DROP COLUMN into
// "allow NULL" so the old data stays (nothing is deleted, Known Issue #55), and (3) makes `down` refuse to run.
import fs from "node:fs";
const file = process.argv[2];
let t = fs.readFileSync(file, "utf8");

const upStart = t.indexOf("export async function up");
const downStart = t.indexOf("export async function down");
if (upStart < 0 || downStart < 0) throw new Error("cannot find up/down");
let up = t.slice(upStart, downStart);

// 1. the locale tables the generator made, and the columns each one holds
const tables = [];
const re = /CREATE TABLE "([A-Za-z0-9_]+)_locales" \(([\s\S]*?)\n\s*\);/g;
let m;
while ((m = re.exec(up))) {
  const parent = m[1];
  const columns = [...m[2].matchAll(/^\s*"([A-Za-z0-9_]+)"\s+/gm)].map((c) => c[1]).filter((c) => !["id", "_locale", "_parent_id"].includes(c));
  tables.push({ parent, columns });
}
if (tables.length < 30) throw new Error("expected many locale tables, found " + tables.length);

// 2. copy statements: one English row per existing parent row
const copies = tables
  .map(({ parent, columns }) => {
    const list = columns.map((c) => `"${c}"`).join(", ");
    return `  INSERT INTO "${parent}_locales" ("_locale", "_parent_id", ${list})\n    SELECT 'en', "id", ${list} FROM "${parent}";`;
  })
  .join("\n");

const header = `
  -- Text that can now be translated moves into per-language tables. Every existing value is copied into the English row first;
  -- the old columns are then kept (unused, and allowed to be empty), so nothing is deleted.
${copies}
`;

// 3. insert the copies before the first DROP COLUMN, and turn each drop into "allow NULL"
const firstDrop = up.search(/\n\s*ALTER TABLE "[A-Za-z0-9_]+" DROP COLUMN /);
if (firstDrop < 0) throw new Error("no DROP COLUMN found");
let dropped = 0;
up = up.slice(0, firstDrop) + "\n" + header + up.slice(firstDrop);
up = up.replace(/ALTER TABLE "([A-Za-z0-9_]+)" DROP COLUMN "([A-Za-z0-9_]+)";/g, (_all, table, col) => {
  dropped += 1;
  return `ALTER TABLE "${table}" ALTER COLUMN "${col}" DROP NOT NULL;`;
});

const down = `export async function down(_args: MigrateDownArgs): Promise<void> {
  // Not reversible on purpose: the old columns were kept, but text written since then lives only in the per-language tables.
  throw new Error("This migration cannot be reversed. Restore from a backup taken before it ran.");
}
`;

t = t.slice(0, upStart) + up + down;
fs.writeFileSync(file, t);
console.log(`locale tables: ${tables.length}; copy statements: ${tables.length}; columns kept instead of dropped: ${dropped}`);
