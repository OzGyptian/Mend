#!/usr/bin/env bash
#
# sync-ecc.sh — re-vendor the Mend-relevant slice of the ECC coding rules into the repo.
#
# ECC is a personal, multi-language engineering-standards framework that lives in
# ~/.claude/rules/ecc. Mend does NOT depend on it at runtime. Instead we vendor a frozen
# COPY of the slice that applies to a TypeScript / React / Vite app (common + typescript +
# web) into .claude/rules/, so the repo is self-contained and BOTH developers' Claude read
# the identical rulebook.
#
# Run this only when you deliberately want to pull upstream improvements down into the repo.
# Commit the result like any other change. Everyone who is not the ECC maintainer can ignore
# this script — the already-vendored copy in .claude/rules/ is what they use.
#
# Usage:
#   ./scripts/sync-ecc.sh                      # uses ~/.claude/rules/ecc
#   ECC_SRC=/path/to/ecc ./scripts/sync-ecc.sh # custom source
#
set -euo pipefail

ECC_SRC="${ECC_SRC:-$HOME/.claude/rules/ecc}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/.claude/rules"

if [ ! -d "$ECC_SRC" ]; then
  echo "ERROR: ECC source not found at: $ECC_SRC" >&2
  echo "       This script is only for the ECC maintainer. Set ECC_SRC=/path/to/ecc if" >&2
  echo "       your copy lives elsewhere. Everyone else uses the vendored .claude/rules/." >&2
  exit 1
fi

for slice in common typescript web; do
  if [ ! -d "$ECC_SRC/$slice" ]; then
    echo "ERROR: expected slice missing at $ECC_SRC/$slice" >&2
    exit 1
  fi
  rm -rf "${DEST:?}/$slice"
  cp -R "$ECC_SRC/$slice" "$DEST/$slice"
  count="$(find "$DEST/$slice" -name '*.md' | wc -l | tr -d ' ')"
  echo "synced: $slice ($count files)"
done

echo
echo "Done. Review with:  git diff .claude/rules"
echo "Then commit if the changes are intended."
