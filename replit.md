# BD Tech Manager / Sales Navigator

A commercial BI platform for BluePex and Opus Tech. Tracks deals, commissions, KPIs, and financials for B2B sales teams.

## Architecture

- **Frontend**: React + Vite + TypeScript, running at `artifacts/bd-tech-manager/`
- **Backend/Auth/DB**: Supabase (kept as-is from original Lovable.dev project — do NOT replace)
- **Styling**: Tailwind CSS v3, dark B2B design system

## Key Decisions

- Supabase URL and anon key are hardcoded in `src/integrations/supabase/client.ts` (intentional per handoff)
- `lovable-tagger` removed from vite.config (Replit-incompatible dev tool)
- CSS `@import` moved before `@tailwind` directives to fix PostCSS ordering
- Bootstrap CJS override at `.local/skills/artifacts/package.json` — enables artifact creation when root `package.json` has `"type": "module"`

## Important Files

- `artifacts/bd-tech-manager/src/integrations/supabase/client.ts` — Supabase client
- `artifacts/bd-tech-manager/src/hooks/useAuth.tsx` — Auth logic
- `artifacts/bd-tech-manager/src/App.tsx` — Root app with React Router + AuthProvider
- `artifacts/bd-tech-manager/src/pages/` — Index (dashboard), Auth, Financeiro, Settings
- `artifacts/bd-tech-manager/vite.config.ts` — Vite config (reads PORT + BASE_PATH from env)
- `artifacts/bd-tech-manager/tailwind.config.ts` — Tailwind v3 config

## User Roles

- Standard sales users: see deals dashboard, KPI cards, financeiro
- System admins (`isPureSystemAdmin`): redirected to /settings on login

## Constraints (per CODEX_HANDOFF.md)

- Keep Supabase as backend — do NOT migrate to Drizzle, Express, or Clerk
- Replit is for running/previewing, not replacing the tech stack
