# Workspace

## Overview

pnpm workspace monorepo using TypeScript. BD Tech Manager — a B2B commission and deals tracking app for sales teams, ported from Lovable.dev to the Replit stack.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (via `@clerk/react` + `@clerk/express`) — ClerkProvider in App.tsx, proxy middleware in api-server
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind v3 + shadcn/ui + wouter (routing)

## Artifacts

- `artifacts/bd-tech-manager/` — BD Tech Manager web app (previewPath: `/`)
  - Dark B2B design system (palette: #0F1117 base, #4F8EF7 blue, #00D084 green)
  - Auth via Clerk; all data via Express API (`/api/*`)
  - Roles: admin, gestor, user; Positions: Diretor, Executivo de Negócios, SDR
- `artifacts/api-server/` — Express API server (previewPath: `/api`)
  - Routes: /api/deals, /api/profiles, /api/presentations, /api/notifications, /api/commission-payments, /api/salary-payments
  - Clerk middleware validates session on every request
- `artifacts/mockup-sandbox/` — Design/mockup sandbox

## Database Schema (lib/db/src/schema/)

Tables (all in PostgreSQL via Drizzle):
- `deals` — sales deals with commission/payment state
- `profiles` — user profiles (Clerk userId FK, role, position, commissionPercent, fixedSalary)
- `presentations` — monthly presentation counts per operation
- `notifications` — per-user notifications
- `commission_payments` — granular commission payment rows per deal/component/month
- `salary_payments` — fixed salary payment records per user/month

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Data Flow

- Frontend (`supabase-deals.ts`) calls `/api/*` endpoints with fetch()
- API server authenticates via Clerk middleware, queries DB with Drizzle
- Drizzle returns camelCase; `supabase-deals.ts` and `Financeiro.tsx` (via `dbToSalaryRow`) normalize both camelCase and snake_case field names
- 30-second polling replaces Supabase Realtime subscriptions

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
