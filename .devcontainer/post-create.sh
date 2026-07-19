#!/usr/bin/env bash
# Runs once when a Codespace is created. Installs deps, installs Claude Code,
# and writes .env.local from the repo's Codespaces secrets (env vars) so the app
# runs with no manual secret handling. Safe to re-run.
set -euo pipefail

echo "→ Installing dependencies (npm ci)..."
npm ci

echo "→ Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code || echo "  (Claude Code install skipped — you can still use claude.ai/code in the browser)"

ENV_FILE=".env.local"
if [ -f "$ENV_FILE" ]; then
  echo "→ $ENV_FILE already exists — leaving it untouched."
else
  echo "→ Writing $ENV_FILE from Codespaces secrets (only vars that are set)..."
  : > "$ENV_FILE"
  for VAR in VITE_ADAPTER VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY \
             SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY \
             GEMINI_API_KEY APP_URL FIREBASE_SERVICE_ACCOUNT_KEY; do
    VALUE="${!VAR:-}"
    if [ -n "$VALUE" ]; then
      printf '%s=%s\n' "$VAR" "$VALUE" >> "$ENV_FILE"
    fi
  done
  COUNT="$(wc -l < "$ENV_FILE" | tr -d ' ')"
  echo "→ Wrote $COUNT secret(s) to $ENV_FILE."
  if [ "$COUNT" = "0" ]; then
    echo "  ⚠ No secrets found. Ask Bernard to set the repo Codespaces secrets"
    echo "    (see .devcontainer/SETUP_NOTES.md), then rebuild the Codespace."
  fi
fi

echo "→ Setup complete. Run 'npm run dev' to start the app."
