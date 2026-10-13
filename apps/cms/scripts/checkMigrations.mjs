// Fails when a migration would delete data: DROP TABLE / DROP COLUMN / DROP TYPE, DELETE FROM or TRUNCATE in its
// `up` half. Taking a plugin away must never delete what its users created, and the usual way that happens by
// accident is generating a migration while a plugin is missing or deactivated (the generator sees its tables as
// removed). A migration that really means to delete data says so with a `polysite:allow-destructive` comment.
//   node scripts/checkMigrations.mjs [migrationsDir]
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../src/migrations"));
const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|TYPE|SCHEMA)|DELETE\s+FROM|TRUNCATE)\b/i;

const problems = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  if (text.includes("polysite:allow-destructive")) continue;
  const upStart = text.search(/export\s+async\s+function\s+up\b/);
  const downStart = text.search(/export\s+async\s+function\s+down\b/);
  const up = upStart < 0 ? text : text.slice(upStart, downStart > upStart ? downStart : undefined);
  up.split("\n").forEach((line, i) => {
    if (DESTRUCTIVE.test(line)) problems.push(`${file}: ${line.trim().slice(0, 100)}`);
  });
}

if (problems.length) {
  console.error("Destructive statements in migrations (data would be deleted):\n  " + problems.slice(0, 15).join("\n  "));
  if (problems.length > 15) console.error(`  ...and ${problems.length - 15} more`);
  console.error(
    "\nIf a plugin was missing or deactivated when this was generated, delete the migration and generate it again with\n" +
      "every plugin active. If deleting data is really intended, add a `// polysite:allow-destructive: <why>` comment.",
  );
  process.exit(1);
}
console.log(`Migrations OK: nothing in ${dir} deletes data.`);
