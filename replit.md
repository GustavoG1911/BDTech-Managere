# Workspace

## Overview

pnpm workspace monorepo using TypeScript. BD Tech Manager — a B2B commission and deals tracking app for sales teams, ported from Lovable.dev.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (lib/db); Supabase (legacy — BD Tech Manager frontend uses Supabase directly for auth, realtime, and data)
- **Auth**: Supabase Auth (email/password + Google OAuth) — used by BD Tech Manager
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind v3 + shadcn/ui

## Artifacts

- `artifacts/bd-tech-manager/` — BD Tech Manager web app (previewPath: `/`)
  - Dark B2B design system (palette: #0F1117 base, #4F8EF7 blue, #00D084 green)
  - Uses Supabase for auth, data (deals, profiles, presentations, notifications, commission_payments), and realtime
  - Roles: admin, gestor, user; Positions: Diretor, Executivo de Negócios, SDR
- `artifacts/api-server/` — Express API server (previewPath: `/api`)
- `artifacts/mockup-sandbox/` — Design/mockup sandbox

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Supabase Configuration

BD Tech Manager connects to Supabase project `ardjxmurnswohqotlyus` using the anon key embedded in `src/integrations/supabase/client.ts`. Tables: deals, profiles, presentations, notifications, commission_payments, calendar_events.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
