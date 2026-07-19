# Codespaces setup — one-time, for Bernard

This makes GitHub Codespaces a one-click dev environment for Mend, with secrets shared
centrally so no one ever handles a raw key file. Do this once.

## 1. Set the repo Codespaces secrets

GitHub → `OzGyptian/Mend` → **Settings → Secrets and variables → Codespaces → New repository secret**.

Add one secret per variable. Names must match **exactly** (case-sensitive) — they map straight
to `.env.local` inside the Codespace.

**The easiest source for every value: your own local `.env.local`** — copy each value across.
Where a value isn't in your local file, the origin is noted below.

### Required — the app won't run without these 4 (all from Supabase → `mend-migration-scratch`)

| Secret name | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → **API** → *Project URL* |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → **API** → *Project API keys* → `anon` / `public` |
| `SUPABASE_URL` | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → **API** → *Project API keys* → `service_role` (click reveal) |

> Newer Supabase dashboards label these **"Publishable key"** (= anon) and **"Secret keys"**
> (= service_role). Same things.

### Optional — only add if/when a feature needs them (your local `.env.local` doesn't have these today)

| Secret name | Needed for | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Sending invite emails (`/api/invite`) | resend.com → API Keys |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Accepting invites (`/api/accept-invite`) | Firebase Console → Project Settings → Service accounts → Generate new private key (paste JSON as **one line**) |
| `APP_URL` | Links inside invite emails | e.g. the prod URL |
| `VITE_ADAPTER` | Forcing the in-memory adapter for tests | literal `memory` (leave unset for normal Supabase use) |
| `GEMINI_API_KEY` | Future AI features (unused today) | Google AI Studio |

> **Firebase note:** the app's *client* Firebase config is the committed, public
> `firebase-applet-config.json` — **not** a secret. So there are no `VITE_FIREBASE_*` secrets to
> set. The only Firebase secret is the server-side `FIREBASE_SERVICE_ACCOUNT_KEY` above, and
> only if you want invite-acceptance to work in the Codespace.

## 2. That's it

When a Codespace is created, `.devcontainer/post-create.sh` reads whichever of these secrets are
set and writes them into `.env.local` automatically. `npm run dev` then works with zero manual
secret handling. (Vars you didn't set are simply skipped.)

## Notes

- **Cost:** Codespaces has a free monthly allowance (currently 60–120 core-hours + storage for
  personal accounts). It auto-suspends after 30 min idle. Fine at two developers' usage; the
  habit is just to stop a Codespace when done.
- **Updating a secret:** change it here, then rebuild the Codespace (Command Palette →
  "Codespaces: Rebuild Container") to pick up the new value.
- **Local dev is unaffected:** anyone using a local `.env.local` keeps using it; this only
  affects Codespaces.
