#!/bin/sh
# Verifies that a release is consistent before anything is built: the version being released equals VERSION and every
# package.json (and its lock file), and CHANGELOG.md has a dated, non-empty section for it. Prints what the workflow needs.
#   .github/scripts/check-version.sh [--lenient] <version or tag>        e.g. 0.1.0-beta.1 or v0.1.0-beta.1
# --lenient reports problems as warnings and still exits 0 (the manual dry run of the release workflow uses it).
# When GITHUB_OUTPUT is set it also writes: version, tag, minor, prerelease, latest (true only for a stable release).
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
. "$ROOT/.github/scripts/lib.sh"

lenient=false
if [ "${1:-}" = "--lenient" ]; then lenient=true; shift; fi
given=${1:?usage: check-version.sh [--lenient] <version or tag>}
version=${given#v}
semver_valid "$version" || die "'$given' is not a version like 1.2.3 or 1.2.3-beta.1"

problems=""
note() { problems="$problems
  - $*"; }

file_version=$(tr -d ' \r\n' < "$ROOT/VERSION")
[ "$file_version" = "$version" ] || note "VERSION says $file_version, not $version (update VERSION, the changelog and the package versions to match, commit, then tag)"

for dir in $VERSIONED_PACKAGES; do
  pv=$(package_version "$ROOT/$dir/package.json")
  [ "$pv" = "$version" ] || note "$dir/package.json has version '${pv:-none}', expected $version"
  lv=$(sed -n '1,12p' "$ROOT/$dir/package-lock.json" | sed -n 's/^  "version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  [ "$lv" = "$version" ] || note "$dir/package-lock.json has version '${lv:-none}', expected $version"
done

if grep -q "^## \[$version\] - [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\$" "$ROOT/CHANGELOG.md"; then
  changelog_section "$ROOT/CHANGELOG.md" "$version" | section_has_content || note "CHANGELOG.md section [$version] is empty"
else
  note "CHANGELOG.md has no dated section '## [$version] - YYYY-MM-DD'"
fi

if [ -n "$problems" ]; then
  printf 'Release %s is not consistent:%s\n' "$version" "$problems" >&2
  if [ "$lenient" = true ]; then echo "(continuing: --lenient)" >&2; else exit 1; fi
fi

minor=$(printf '%s' "$version" | sed -E 's/^([0-9]+\.[0-9]+)\..*/\1/')
case "$version" in *-*) pre=true; latest=false ;; *) pre=false; latest=true ;; esac
echo "Release $version is consistent (minor line $minor, pre-release: $pre, moves 'latest': $latest)."
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  { echo "version=$version"; echo "tag=v$version"; echo "minor=$minor"; echo "prerelease=$pre"; echo "latest=$latest"; } >> "$GITHUB_OUTPUT"
fi
