# 📕 Archive — historical / superseded documents

**Do not plan work from anything in this folder.** These are kept for history only.

The design analysis here has been **superseded** — first by the Firestore→Postgres/Supabase
migration (which resolved or reframed most of its structural findings), and then by a newer,
Postgres-era audit.

## Where the *current* design work lives

| I want… | Look here |
|---------|-----------|
| The current system review + prioritized roadmap | **`docs/audit/phase-5-report.md`** (2026‑07‑17) — plus `docs/audit/phase-0..4` for the detail |
| The live backlog / what to build next | **GitHub Issues** (`OzGyptian/Mend`) — the audit's findings are filed as #23–#26, plus #12–#18 |
| Project conventions & architecture | `CLAUDE.md` (repo root) |
| App specs | `TECHNICAL_SPEC.md` / `FUNCTIONAL_SPEC.md` (repo root) |

## What's in here and why it's archived

| File | What it was | Why archived |
|------|-------------|--------------|
| `SYSTEM_REVIEW-2026-07-11.md` | System Review v2 — the main design review (Firestore era, v1.0.86) | Predates the Postgres migration it recommended; its critical items (compute-on-read F1, invite-security F3, onboarding F10, CI) were subsequently done. Superseded by `docs/audit/`. |
| `firebase-blueprint.json` | Firestore project blueprint | Firestore era; the app now runs on Postgres/Supabase. |

The old `Mend/` subfolder that held these (plus exact duplicates of the root specs) has been
retired to remove the "two copies in two places" confusion. Local-only `.docx` strategy/analysis
drafts that were never tracked in git remain on individual machines and are not part of the repo.
