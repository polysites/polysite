#!/bin/sh
# Shared helpers for the release tooling. Sourced, not run. POSIX sh and awk only: no Node on the host.

# shellcheck disable=SC2034  # used by the scripts that source this file
REPO_URL="https://github.com/polysites/polysite"

# Files whose "version" must equal VERSION. (package-lock.json carries the root package's version twice.)
VERSIONED_PACKAGES="apps/cms apps/web"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# X.Y.Z or X.Y.Z-pre.release (no leading zeros in the numbers, no build metadata).
semver_valid() {
  printf '%s' "$1" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
}

# Prints -1, 0 or 1: how $1 ranks against $2 by Semantic Versioning precedence (a release outranks its own pre-releases).
semver_cmp() {
  awk -v a="$1" -v b="$2" '
    function parse(v, o,    i, core, n, c) {
      i = index(v, "-")
      if (i) { o["pre"] = substr(v, i + 1); core = substr(v, 1, i - 1) } else { o["pre"] = ""; core = v }
      n = split(core, c, ".")
      o["maj"] = c[1] + 0; o["min"] = c[2] + 0; o["pat"] = c[3] + 0
    }
    function isnum(s) { return s ~ /^[0-9]+$/ }
    function cmpn(x, y) { return x < y ? -1 : (x > y ? 1 : 0) }
    BEGIN {
      parse(a, A); parse(b, B)
      r = cmpn(A["maj"], B["maj"]); if (r == 0) r = cmpn(A["min"], B["min"]); if (r == 0) r = cmpn(A["pat"], B["pat"])
      if (r == 0) {
        if (A["pre"] == "" && B["pre"] == "") r = 0
        else if (A["pre"] == "") r = 1
        else if (B["pre"] == "") r = -1
        else {
          na = split(A["pre"], pa, "."); nb = split(B["pre"], pb, ".")
          m = na < nb ? na : nb
          for (k = 1; k <= m && r == 0; k++) {
            if (isnum(pa[k]) && isnum(pb[k])) r = cmpn(pa[k] + 0, pb[k] + 0)
            else if (isnum(pa[k])) r = -1
            else if (isnum(pb[k])) r = 1
            else r = (pa[k] < pb[k] ? -1 : (pa[k] > pb[k] ? 1 : 0))
          }
          if (r == 0) r = cmpn(na, nb)
        }
      }
      print r
    }'
}

# The "version" of a package.json (empty when it has none).
package_version() {
  sed -n 's/^  "version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -n 1
}

# Lines of CHANGELOG.md between the heading of a section ("Unreleased" or "1.2.3") and the next "## [" heading.
changelog_section() { # <CHANGELOG.md> <Unreleased | version>
  awk -v want="$2" '
    /^## \[/ { if (on) exit; if (index($0, "## [" want "]") == 1) { on = 1; next } }
    on { print }
  ' "$1"
}

# Does a section have real content (at least one list item or paragraph line, not just empty headings)?
section_has_content() { # reads stdin
  grep -Eq '^[[:space:]]*([-*]|[0-9]+\.)[[:space:]]+[^[:space:]]|^[A-Za-z]' 
}

# Files in this repository are LF or CRLF depending on how they were checked out (and package-lock.json is CRLF in the index),
# and awk may drop the CR on the way through. Edits must keep each file's own line endings, or the whole file shows as changed.
has_crlf() { [ "$(head -c 2000 "$1" | tr -cd '\r' | wc -c | tr -d ' ')" -gt 0 ]; }
# Writes the edited copy $2 over $1 in $1's own line-ending style.
write_like() {
  if has_crlf "$1"; then
    cr=$(printf '\r')
    tr -d '\r' < "$2" | sed "s/\$/$cr/" > "$1"
  else
    tr -d '\r' < "$2" > "$1"
  fi
}
