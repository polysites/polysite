#!/bin/sh
# Prints the body of one CHANGELOG.md section (used for the GitHub release notes). Fails if the section is missing or empty.
#   .github/scripts/changelog-section.sh <version | Unreleased>
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
. "$ROOT/.github/scripts/lib.sh"
want=${1:?usage: changelog-section.sh <version | Unreleased>}
want=${want#v}
body=$(changelog_section "$ROOT/CHANGELOG.md" "$want")
[ -n "$body" ] || die "CHANGELOG.md has no section [$want]"
printf '%s\n' "$body" | section_has_content || die "CHANGELOG.md section [$want] is empty"
printf '%s\n' "$body" | sed -e :a -e '/^[[:space:]]*$/{$d;N;ba' -e '}' | sed '/./,$!d'
