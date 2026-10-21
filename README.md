# Multimate Business

ליווי עסקי מדיד: אבחון → ממצאים → תעדוף → יעדים → משימות → ביצוע → מדידה.
פיילוט: **אורשינא** (אורית חסון). ראו את ה-PRD לפרטים המלאים.

## Stack
- Next.js 15 (App Router, client components) + Tailwind 4, Hebrew RTL
- Supabase (Postgres + Auth + RLS) — project `multimate-business` (`mlchjmbbiwhpgbcjnlka`, eu-central-1)
- Hosting: Vercel (import this repo)

## Run locally
```bash
cp .env.example .env.local   # fill in the publishable key
npm install
npm run dev
```

Only the **publishable** key goes in the client. Never commit or expose the service-role key.

## Deploy (Vercel)
Import `ilayor/multimate-business` in Vercel, framework Next.js, and set:
- `NEXT_PUBLIC_SUPABASE_URL=https://mlchjmbbiwhpgbcjnlka.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`

Then in Supabase → Authentication → URL Configuration, set Site URL to the Vercel URL.

## Database
- `supabase/migrations/0001_init.sql` — schema, RLS, RPCs (applied).
- `supabase/seed/pilot_template.sql` — the 30-question pilot diagnostic (already seeded).
- `supabase/tests/rls_isolation.sql` — cross-tenant regression tests (rolls back). All must pass.

### Security model
- Access to any business data goes only through `business_memberships` (`consultant` | `owner`). Org membership alone reveals nothing.
- Owners: read their business, answer diagnostics, update status/comment on tasks assigned to them (enforced by trigger). They cannot see findings, draft meetings or `meeting_private_notes`.
- Diagnostic question wording is snapshotted per session and immutable (trigger).
- `start_diagnostic` / `create_business` are `security definer` RPCs that check authorization.

## Status
- Done (Slice 0 + 1, partial 2/3): login, businesses, 6-section diagnostic with autosave/resume and "unknown" flag, findings from answers with priority heuristic, tasks + weekly commitments (max 3), meetings with shared summary / private notes / publish.
- Not yet: owner invitation flow (owners are added manually for now), goals & metrics UI, dashboard, audit trail coverage, export, automated test runner in CI.
