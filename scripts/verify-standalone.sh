#!/usr/bin/env bash
#
# verify-standalone.sh — sanity-check that Mend is self-contained: it builds and runs from
# the repo + environment variables alone, with no dependency on any developer's personal
# ~/.claude or hardcoded home paths. Run this before onboarding a new developer, and any
# time you touch the dev-environment scaffolding.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fail=0
ok()  { printf '  \033[32m✅\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m❌\033[0m %s\n' "$1"; fail=1; }

echo "== 1. Required files present =="
for f in package.json package-lock.json CLAUDE.md ONBOARDING.md .nvmrc .env.example \
         .claude/settings.json .claude/rules/common/coding-style.md \
         firebase-applet-config.json; do
  [ -e "$f" ] && ok "$f" || bad "missing: $f"
done

echo "== 2. No hardcoded home paths in committed config/source =="
if grep -rInE '/Users/[a-zA-Z]+|/home/[a-zA-Z]+' \
      .claude/settings.json .github scripts src server.ts 2>/dev/null; then
  bad "hardcoded home path(s) above — use a relative path or \$CLAUDE_PROJECT_DIR"
else
  ok "no hardcoded home paths"
fi

echo "== 3. Secrets never committed =="
if git check-ignore -q .env.local; then ok ".env.local is gitignored"; else bad ".env.local is NOT gitignored"; fi

echo "== 4. Type-check (npm run lint) =="
if npm run lint >/tmp/verify-lint.log 2>&1; then ok "npm run lint"; else bad "npm run lint failed — see /tmp/verify-lint.log"; fi

echo "== 5. Production build (npm run build) =="
if npm run build >/tmp/verify-build.log 2>&1; then ok "npm run build"; else bad "npm run build failed — see /tmp/verify-build.log"; fi

echo
if [ "$fail" -eq 0 ]; then
  echo "🎉 standalone checks passed"
else
  echo "⚠️  standalone checks FAILED — fix the ❌ items above"
  exit 1
fi
