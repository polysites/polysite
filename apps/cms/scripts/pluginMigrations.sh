#!/bin/sh
# Generates and checks database migrations so that the core and each plugin own only their own tables.
#
#   scripts/pluginMigrations.sh core <name>            create a migration for the core alone (no plugin loaded)
#   scripts/pluginMigrations.sh plugin <slug> <name>   create a migration for one plugin, into plugins/<slug>/migrations
#   scripts/pluginMigrations.sh check [<slug>]         verify that the core and every plugin (or just <slug>) own only their tables
#
# Run it inside the CMS container, from anywhere:   docker compose exec cms sh scripts/pluginMigrations.sh check
#
# How it stays honest: a plugin's migration is generated as the difference between "the core" and "the core plus this one
# plugin" (POLYSITE_PLUGINS_ONLY loads just that plugin), so it contains only what the plugin adds. A plugin's later
# migrations are generated against the snapshot its previous one left (core + that plugin). The check regenerates each
# plugin against its latest snapshot and fails if anything changed that has no migration, and fails any plugin migration that
# alters a table it did not create (Payload's own bookkeeping tables, which get one column per collection, are the only
# exception).
set -eu

cd "$(dirname "$0")/.."
PLUGINS_DIR=${PLUGINS_DIR:-../../plugins}
CORE_DIR=src/migrations
# Payload and the URL index keep one column per collection in these (which documents are locked or have saved preferences; which
# collections the index points to): installing a plugin that adds a collection adds a column there, and nothing else of the core changes.
ALLOWED_TABLES="payload_locked_documents_rels payload_preferences_rels site_urls_rels"
# Payload's job queue has an enum of every task slug; a plugin that registers a task adds its slug.
ALLOWED_ENUMS="enum_payload_jobs_task_slug enum_payload_jobs_log_task_slug"

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

latest_snapshot() { ls "$1"/*.json 2>/dev/null | sort | tail -1; }

# generate <migration dir to diff against and write into> <plugins to load> <name>
generate() {
  POLYSITE_MIGRATION_DIR="$1" POLYSITE_PLUGINS_ONLY="$2" npx payload migrate:create "$3" --skip-empty >"$SCRATCH/gen.log" 2>&1 \
    || { echo "The generator failed:"; tail -25 "$SCRATCH/gen.log"; exit 1; }
}

# Prepares a scratch folder holding only the snapshot a new migration is compared with.
seed_scratch() { # <snapshot file>
  rm -rf "$SCRATCH/m"; mkdir -p "$SCRATCH/m"
  cp "$1" "$SCRATCH/m/"
}

# The tables a plugin migration may touch with ALTER: those the plugin creates (in this migration or an earlier one of its own, so a plugin
# can add a column to its own table later), plus Payload's bookkeeping tables.
check_plugin_migration() { # <slug> <file.js>
  slug=$1; file=$2
  up=$(awk '/^export async function up/{p=1} /^export async function down/{p=0} p' "$file")
  created=$(for m in "$(dirname "$file")"/*.js; do awk '/^export async function up/{p=1} /^export async function down/{p=0} p' "$m"; done | sed -n 's/.*CREATE TABLE "\([a-z0-9_]*\)".*/\1/p')
  altered=$(printf '%s\n' "$up" | sed -n 's/.*ALTER TABLE "\([a-z0-9_]*\)".*/\1/p' | sort -u)
  bad=""
  for t in $altered; do
    ok=0
    for c in $created $ALLOWED_TABLES; do [ "$c" = "$t" ] && ok=1; done
    [ "$ok" = 1 ] || bad="$bad $t"
  done
  # An ALTER on a core table: only a column Payload itself adds for the plugin's collections is acceptable, and those are in the allowed list.
  if [ -n "$bad" ]; then
    echo "FAIL  $slug: $(basename "$file") alters tables it did not create:$bad"
    return 1
  fi
  # Adding a value to an existing enum changes a type some other table owns, except Payload's job queue, which lists every task slug.
  badtypes=""
  for t in $(printf '%s\n' "$up" | sed -n 's/.*ALTER TYPE "public"\."\([a-z0-9_]*\)".*/\1/p' | sort -u); do
    ok=0
    for c in $ALLOWED_ENUMS; do [ "$c" = "$t" ] && ok=1; done
    [ "$ok" = 1 ] || badtypes="$badtypes $t"
  done
  if [ -n "$badtypes" ]; then
    echo "FAIL  $slug: $(basename "$file") changes types it did not create:$badtypes"
    return 1
  fi
  if printf '%s\n' "$up" | grep -Eq 'DROP (TABLE|COLUMN|TYPE)|DELETE FROM|TRUNCATE'; then
    echo "FAIL  $slug: $(basename "$file") deletes data or structure in up()"
    return 1
  fi
  return 0
}

# Strips the TypeScript out of a generated migration so a plugin can ship it as plain JavaScript.
to_plain_js() { # <in.ts> <out.js>
  sed -e "/^import .*@payloadcms\/db-postgres/d" \
      -e 's/{ db, payload, req }: MigrateUpArgs/{ db, sql }/' \
      -e 's/{ db, payload, req }: MigrateDownArgs/{ db, sql }/' \
      -e 's/): Promise<void>/)/' "$1" | sed '/./,$!d' >"$2"
}

cmd=${1:-}
case "$cmd" in
  core)
    name=${2:?usage: pluginMigrations.sh core <name>}
    base=$(latest_snapshot "$CORE_DIR")
    if [ -n "$base" ]; then seed_scratch "$base"; else rm -rf "$SCRATCH/m"; mkdir -p "$SCRATCH/m"; fi
    generate "$SCRATCH/m" none "$name"
    created=$(ls "$SCRATCH/m" | grep "_${name}\." || true)
    [ -n "$created" ] || { echo "No change to the core's tables."; exit 0; }
    for f in $created; do cp "$SCRATCH/m/$f" "$CORE_DIR/$f"; done
    # Rebuild the index from the files in the folder (the scratch run knew only the new one), so it lists every migration and none that is gone.
    names=$(ls "$CORE_DIR"/*.ts | grep -v '/index\.ts$' | sort | xargs -n1 basename | sed 's/\.ts$//')
    {
      for s in $names; do echo "import * as migration_$s from './$s';"; done
      printf '\nexport const migrations = [\n'
      for s in $names; do printf "  {\n    up: migration_%s.up,\n    down: migration_%s.down,\n    name: '%s'\n  },\n" "$s" "$s" "$s"; done
      printf '];\n'
    } >"$CORE_DIR/index.ts"
    echo "Created $CORE_DIR/$(echo "$created" | head -1)"
    ;;

  plugin)
    slug=${2:?usage: pluginMigrations.sh plugin <slug> <name>}
    name=${3:?usage: pluginMigrations.sh plugin <slug> <name>}
    dir="$PLUGINS_DIR/$slug/migrations"
    mkdir -p "$dir"
    base=$(latest_snapshot "$dir"); [ -n "$base" ] || base=$(latest_snapshot "$CORE_DIR")
    [ -n "$base" ] || { echo "The core has no migration yet; create it first."; exit 1; }
    seed_scratch "$base"
    generate "$SCRATCH/m" "$slug" "$name"
    ts_file=$(ls "$SCRATCH/m" | grep "_${name}\.ts$" || true)
    [ -n "$ts_file" ] || { echo "$slug: no change to its tables."; exit 0; }
    stem=${ts_file%.ts}
    to_plain_js "$SCRATCH/m/$stem.ts" "$dir/$stem.js"
    cp "$SCRATCH/m/$stem.json" "$dir/$stem.json"
    check_plugin_migration "$slug" "$dir/$stem.js" || { rm -f "$dir/$stem.js" "$dir/$stem.json"; echo "Not kept. The plugin must not change tables it does not own (see plugins/README.md)."; exit 1; }
    echo "Created $dir/$stem.js"
    ;;

  rebase)
    # After the CORE gained a migration: re-takes the plugin's latest snapshot as "the core as it now is, plus this plugin as
    # its migrations leave it", without writing any SQL. Run it only when `check <slug>` passed before the core changed.
    slug=${2:?usage: pluginMigrations.sh rebase <slug>}
    dir="$PLUGINS_DIR/$slug/migrations"
    snap=$(latest_snapshot "$dir")
    [ -n "$snap" ] || { echo "$slug has no migration to rebase."; exit 1; }
    seed_scratch "$(latest_snapshot "$CORE_DIR")"
    generate "$SCRATCH/m" "$slug" rebase_tmp
    new=$(ls "$SCRATCH/m"/*_rebase_tmp.json 2>/dev/null | head -1)
    [ -n "$new" ] || { echo "$slug adds nothing to the core's tables; nothing to rebase."; exit 1; }
    cp "$new" "$snap"
    echo "Rebased $snap onto the core's latest snapshot."
    ;;

  check)
    only=${2:-}
    failed=0

    if [ -z "$only" ]; then
      base=$(latest_snapshot "$CORE_DIR")
      if [ -z "$base" ]; then echo "FAIL  core: no migration"; failed=1; else
        seed_scratch "$base"; generate "$SCRATCH/m" none core_check
        if ls "$SCRATCH/m" | grep -q '_core_check\.'; then echo "FAIL  core: its tables changed without a migration"; failed=1; else echo "ok    core: its migrations match its tables"; fi
      fi
    fi

    for manifest in "$PLUGINS_DIR"/*/polysite.plugin.json; do
      [ -f "$manifest" ] || continue
      pdir=$(dirname "$manifest")
      slug=$(sed -n 's/.*"slug"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -1)
      [ -z "$only" ] || [ "$only" = "$slug" ] || continue
      mdir="$pdir/migrations"

      # 1. the plugin's migrations alter only what they create
      if [ -d "$mdir" ]; then
        for f in "$mdir"/*.js; do [ -f "$f" ] || continue; check_plugin_migration "$slug" "$f" || failed=1; done
      fi

      # 2. nothing the plugin defines is missing a migration (compared with its own latest snapshot, or the core's if it has none)
      base=$(latest_snapshot "$mdir"); [ -n "$base" ] || base=$(latest_snapshot "$CORE_DIR")
      seed_scratch "$base"; generate "$SCRATCH/m" "$slug" plugin_check
      if ls "$SCRATCH/m" | grep -q '_plugin_check\.'; then
        echo "FAIL  $slug: its tables changed without a migration (run: scripts/pluginMigrations.sh plugin $slug <name>)"; failed=1
      else
        echo "ok    $slug: its migrations match its tables and touch nothing of the core's"
      fi

      # 3. its tables are the same whatever else is installed (no enum built from another plugin's collections, say)
      snap=$(latest_snapshot "$mdir")
      if [ -n "$snap" ]; then
        if [ ! -f "$SCRATCH/all.json" ]; then
          seed_scratch "$(latest_snapshot "$CORE_DIR")"; generate "$SCRATCH/m" "" all_check
          cp "$SCRATCH/m"/*_all_check.json "$SCRATCH/all.json"
        fi
        if differences=$(node scripts/comparePluginSnapshots.mjs "$(latest_snapshot "$CORE_DIR")" "$snap" "$SCRATCH/all.json"); then
          echo "ok    $slug: its tables do not depend on which other plugins are installed"
        else
          echo "FAIL  $slug: its tables depend on which other plugins are installed:"; echo "$differences" | sed 's/^/        /'; failed=1
        fi
      fi
    done

    [ "$failed" = 0 ] || exit 1
    ;;

  *)
    sed -n '2,8p' "$0"
    exit 2
    ;;
esac
